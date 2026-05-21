using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using PolancoWatch.Application.Interfaces;
using Docker.DotNet;
using Docker.DotNet.Models;

namespace PolancoWatch.Infrastructure.Services;

public class BackupService : IBackupService
{
    private readonly IConfiguration _configuration;
    private readonly IDockerClient _dockerClient;
    private readonly string _backupRootPath;
    private readonly string[] _allowedPaths;

    public BackupService(IConfiguration configuration, IDockerClient dockerClient)
    {
        _configuration = configuration;
        _dockerClient = dockerClient;
        string root = configuration["Backup:RootPath"] ?? Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "backups");
        _backupRootPath = Path.GetFullPath(root);
        _allowedPaths = configuration.GetSection("Backup:AllowedPaths").Get<string[]>() ?? Array.Empty<string>();

        if (!Directory.Exists(_backupRootPath))
        {
            Directory.CreateDirectory(_backupRootPath);
        }
    }

    public async Task<List<string>> GetContainerDatabasesAsync(string containerId, string dbUser = "root", string? dbPass = null)
    {
        if (string.IsNullOrEmpty(dbPass))
        {
            return new List<string>();
        }

        string cmd = $"mysql -u {ShellQuote(dbUser)} -p{ShellQuote(dbPass)} -e 'SHOW DATABASES;' -s --skip-column-names || mariadb -u {ShellQuote(dbUser)} -p{ShellQuote(dbPass)} -e 'SHOW DATABASES;' -s --skip-column-names";

        var execParams = new ContainerExecCreateParameters
        {
            AttachStdout = true,
            AttachStderr = true,
            Cmd = new[] { "sh", "-c", cmd }
        };

        try
        {
            var execResponse = await _dockerClient.Exec.ExecCreateContainerAsync(containerId, execParams);
            using (var stream = await _dockerClient.Exec.StartAndAttachContainerExecAsync(execResponse.ID, false, CancellationToken.None))
            {
                var res = await stream.ReadOutputToEndAsync(CancellationToken.None);
                if (!string.IsNullOrEmpty(res.stderr) && res.stderr.Contains("error", StringComparison.OrdinalIgnoreCase) && !res.stderr.Contains("Warning: Using a password", StringComparison.OrdinalIgnoreCase))
                {
                    return new List<string>();
                }
                
                var databases = new List<string>();
                var lines = res.stdout.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                foreach (var line in lines)
                {
                    var trimmed = line.Trim();
                    if (!string.IsNullOrEmpty(trimmed) && trimmed != "information_schema" && trimmed != "performance_schema" && trimmed != "mysql" && trimmed != "sys")
                    {
                        databases.Add(trimmed);
                    }
                }
                return databases;
            }
        }
        catch (Exception)
        {
            return new List<string>();
        }
    }

    public Task DeleteBackupFileAsync(string filePath)
    {
        if (string.IsNullOrEmpty(filePath)) return Task.CompletedTask;

        string normalizedPath = filePath.Replace('/', Path.DirectorySeparatorChar).Replace('\\', Path.DirectorySeparatorChar);

        string backupRootCanonical = Path.GetFullPath(_backupRootPath);
        string targetCanonical = Path.GetFullPath(normalizedPath);

        if (!IsSubFolderOf(targetCanonical, backupRootCanonical))
        {
            throw new UnauthorizedAccessException("Security check failed: Cannot delete a file outside of the backups directory.");
        }

        if (File.Exists(targetCanonical))
        {
            File.Delete(targetCanonical);
        }
        
        return Task.CompletedTask;
    }

    public bool ValidatePath(string path)
    {
        if (string.IsNullOrEmpty(path)) return false;

        try
        {
            string targetCanonical = Path.GetFullPath(path);
            
            string dockerVolumePath = RuntimeInformation.IsOSPlatform(OSPlatform.Windows)
                ? @"C:\var\lib\docker\volumes"
                : "/var/lib/docker/volumes";
            
            string dockerVolumeCanonical = Path.GetFullPath(dockerVolumePath);
            if (IsSubFolderOf(targetCanonical, dockerVolumeCanonical))
                return true;

            foreach (var allowed in _allowedPaths)
            {
                if (string.IsNullOrEmpty(allowed)) continue;
                string allowedCanonical = Path.GetFullPath(allowed);
                if (IsSubFolderOf(targetCanonical, allowedCanonical))
                    return true;
            }
        }
        catch
        {
            return false;
        }
        return false;
    }

    private bool IsSubFolderOf(string target, string parent)
    {
        string targetNormalized = target.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
        string parentNormalized = parent.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
        return targetNormalized.StartsWith(parentNormalized, StringComparison.OrdinalIgnoreCase);
    }

    private static string ShellQuote(string value)
    {
        return $"'{value.Replace("'", "'\\''")}'";
    }
}
