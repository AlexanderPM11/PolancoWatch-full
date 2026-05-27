using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using PolancoWatch.Application.Interfaces;
using PolancoWatch.Domain.Entities;
using PolancoWatch.Domain.Common;
using Docker.DotNet;
using Docker.DotNet.Models;

namespace PolancoWatch.Infrastructure.Services.BackupStrategies;

public class DockerVolumeBackupStrategy : IBackupStrategy
{
    private readonly IDockerClient _dockerClient;
    private readonly IConfiguration _configuration;
    private readonly string _backupRootPath;
    private readonly string[] _allowedPaths;

    public DockerVolumeBackupStrategy(IConfiguration configuration, IDockerClient dockerClient)
    {
        _dockerClient = dockerClient;
        _configuration = configuration;
        string root = configuration["Backup:RootPath"] ?? Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "backups");
        _backupRootPath = Path.GetFullPath(root);
        _allowedPaths = configuration.GetSection("Backup:AllowedPaths").Get<string[]>() ?? Array.Empty<string>();
    }

    public bool CanHandle(BackupType type, string targetPath)
    {
        return type == BackupType.Volume;
    }

    public async Task<string> ExecuteBackupAsync(BackupContext context)
    {
        string backupName = context.BackupName;
        if (!string.IsNullOrEmpty(backupName))
        {
            backupName = Path.GetFileName(backupName);
            backupName = string.Join("_", backupName.Split(Path.GetInvalidFileNameChars()));
        }

        string volumeName = await GetVolumeNameFromPathAsync(context.TargetPath) ?? string.Empty;
        bool isDockerVolume = !string.IsNullOrEmpty(volumeName);

        if (!isDockerVolume && !ValidatePath(context.TargetPath))
        {
            throw new UnauthorizedAccessException($"Path '{context.TargetPath}' is not in the allowed backup paths.");
        }

        string extension = context.Format == BackupFormat.Zip ? ".zip" : ".tar.gz";
        string fileName = $"{backupName}_{TimeHelper.Now:yyyyMMddHHmmss}{extension}";
        string destinationPath = Path.Combine(_backupRootPath, fileName);

        try
        {
            if (isDockerVolume)
            {
                await CreateDockerVolumeArchiveAsync(volumeName, destinationPath, context.Format);
            }
            else
            {
                await Task.Run(() =>
                {
                    if (context.Format == BackupFormat.Zip)
                    {
                        ZipFile.CreateFromDirectory(context.TargetPath, destinationPath, CompressionLevel.SmallestSize, includeBaseDirectory: false);
                    }
                    else
                    {
                        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                        {
                            ExecuteTarCommand(context.TargetPath, destinationPath);
                        }
                        else
                        {
                            ZipFile.CreateFromDirectory(context.TargetPath, destinationPath, CompressionLevel.SmallestSize, includeBaseDirectory: false);
                        }
                    }
                });
            }
        }
        catch (Exception)
        {
            try
            {
                if (File.Exists(destinationPath))
                {
                    File.Delete(destinationPath);
                }
            }
            catch { }
            throw;
        }

        var fileInfo = new FileInfo(destinationPath);
        if (!fileInfo.Exists || fileInfo.Length == 0)
        {
            throw new InvalidOperationException($"Backup generation failed: Destination file '{destinationPath}' is missing or is 0 bytes.");
        }

        return destinationPath;
    }

    private async Task<string?> GetVolumeNameFromPathAsync(string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return null;
        
        string normalizedPath = path.TrimEnd('/', '\\');
        
        try
        {
            var volumes = await _dockerClient.Volumes.ListAsync();
            if (volumes?.Volumes != null)
            {
                foreach (var volume in volumes.Volumes)
                {
                    string volumeMountpoint = volume.Mountpoint?.TrimEnd('/', '\\') ?? string.Empty;
                    if (normalizedPath.Equals(volume.Name, StringComparison.OrdinalIgnoreCase) || 
                        normalizedPath.Equals(volumeMountpoint, StringComparison.OrdinalIgnoreCase))
                    {
                        return volume.Name;
                    }
                }
            }
        }
        catch { }
        
        if (normalizedPath.StartsWith("/var/lib/docker/volumes/") || normalizedPath.StartsWith(@"C:\var\lib\docker\volumes\"))
        {
            var parts = normalizedPath.Split(new[] { '/', '\\' }, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length >= 5)
            {
                return parts[4];
            }
        }

        return null;
    }

    private async Task CreateDockerVolumeArchiveAsync(string volumeName, string destinationFilePath, BackupFormat format)
    {
        string? backupDirOnHost = await ResolveBackupHostPathAsync(destinationFilePath);

        if (string.IsNullOrEmpty(backupDirOnHost))
        {
            backupDirOnHost = Path.GetDirectoryName(destinationFilePath) ?? _backupRootPath;
        }

        string fileName = Path.GetFileName(destinationFilePath);
        string safeFileName = ShellQuote(fileName);
        
        await EnsureImageExistsAsync("alpine:latest");

        string cmd = format == BackupFormat.Zip 
            ? $"apk add --no-cache zip && cd /data && zip -r -9 /backup/{safeFileName} ." 
            : $"apk add --no-cache tar && tar --xattrs --xattrs-include='user.supabase.*' -czf /backup/{safeFileName} -C /data .";

        var containerConfig = new Config
        {
            Image = "alpine:latest",
            Cmd = new[] { "sh", "-c", cmd },
            Tty = false,
            Env = new List<string> { "TZ=America/Santo_Domingo" }
        };

        var hostConfig = new HostConfig
        {
            Binds = new[] 
            { 
                $"{volumeName}:/data:ro",
                $"{backupDirOnHost}:/backup"
            }
        };

        var containerParams = new CreateContainerParameters(containerConfig)
        {
            HostConfig = hostConfig,
            Name = $"backup_helper_{Guid.NewGuid():N}"
        };

        var createResponse = await _dockerClient.Containers.CreateContainerAsync(containerParams);

        try
        {
            await _dockerClient.Containers.StartContainerAsync(createResponse.ID, null);
            var waitResponse = await _dockerClient.Containers.WaitContainerAsync(createResponse.ID);
            
            if (waitResponse.StatusCode != 0)
            {
                var logs = await _dockerClient.Containers.GetContainerLogsAsync(createResponse.ID, new ContainerLogsParameters { ShowStderr = true, ShowStdout = true }, CancellationToken.None);
                using var reader = new StreamReader(logs);
                string errorOutput = await reader.ReadToEndAsync();
                throw new Exception($"Docker backup container failed with exit code {waitResponse.StatusCode}. Logs: {errorOutput}");
            }

            if (!File.Exists(destinationFilePath))
            {
                throw new FileNotFoundException($"The backup file was not found at {destinationFilePath} after helper container finished. This usually means the HOST path mapping for backups is incorrect. Detected BACKUP_HOST_PATH: {backupDirOnHost}");
            }
        }
        finally
        {
            await _dockerClient.Containers.RemoveContainerAsync(createResponse.ID, new ContainerRemoveParameters { Force = true });
        }
    }

    private async Task<string?> ResolveBackupHostPathAsync(string destinationFilePath)
    {
        var destinationDirectory = Path.GetDirectoryName(destinationFilePath) ?? _backupRootPath;
        var configured = Environment.GetEnvironmentVariable("BACKUP_HOST_PATH") ?? _configuration["Backup:HostPath"];

        if (!string.IsNullOrWhiteSpace(configured) && await BackendCanSeeHelperOutputAsync(configured, destinationDirectory))
        {
            return configured;
        }

        var hostname = Environment.MachineName;
        if (!string.IsNullOrWhiteSpace(hostname))
        {
            try
            {
                var container = await _dockerClient.Containers.InspectContainerAsync(hostname);
                var backupMount = container.Mounts?.FirstOrDefault(m => string.Equals(m.Destination, destinationDirectory, StringComparison.OrdinalIgnoreCase));
                if (!string.IsNullOrWhiteSpace(backupMount?.Name)) return backupMount.Name;
                if (!string.IsNullOrWhiteSpace(backupMount?.Source)) return backupMount.Source;
            }
            catch { }
        }

        return !string.IsNullOrWhiteSpace(configured) ? configured : destinationDirectory;
    }

    private async Task<bool> BackendCanSeeHelperOutputAsync(string backupHostPath, string destinationDirectory)
    {
        var probeFileName = $".polancowatch_probe_{Guid.NewGuid():N}";
        var backendProbePath = Path.Combine(destinationDirectory, probeFileName);

        var containerConfig = new Config
        {
            Image = "alpine:latest",
            Cmd = new[] { "sh", "-c", $"touch /backup/{probeFileName}" },
            Tty = false
        };

        var containerParams = new CreateContainerParameters(containerConfig)
        {
            HostConfig = new HostConfig { Binds = new[] { $"{backupHostPath}:/backup" } },
            Name = $"backup_probe_{Guid.NewGuid():N}"
        };

        try
        {
            await EnsureImageExistsAsync("alpine:latest");
            var createResponse = await _dockerClient.Containers.CreateContainerAsync(containerParams);

            try
            {
                await _dockerClient.Containers.StartContainerAsync(createResponse.ID, null);
                var waitResponse = await _dockerClient.Containers.WaitContainerAsync(createResponse.ID);
                return waitResponse.StatusCode == 0 && File.Exists(backendProbePath);
            }
            finally
            {
                await _dockerClient.Containers.RemoveContainerAsync(createResponse.ID, new ContainerRemoveParameters { Force = true });
                if (File.Exists(backendProbePath)) File.Delete(backendProbePath);
            }
        }
        catch
        {
            if (File.Exists(backendProbePath)) File.Delete(backendProbePath);
            return false;
        }
    }

    private async Task EnsureImageExistsAsync(string image)
    {
        try
        {
            await _dockerClient.Images.InspectImageAsync(image);
        }
        catch (DockerApiException dex) when (dex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            var parts = image.Split(':');
            var name = parts[0];
            var tag = parts.Length > 1 ? parts[1] : "latest";
            await _dockerClient.Images.CreateImageAsync(
                new ImagesCreateParameters { FromImage = name, Tag = tag }, null, new Progress<JSONMessage>()
            );
        }
    }

    private bool ValidatePath(string path)
    {
        if (string.IsNullOrEmpty(path)) return false;
        try
        {
            string targetCanonical = Path.GetFullPath(path);
            string dockerVolumePath = RuntimeInformation.IsOSPlatform(OSPlatform.Windows) ? @"C:\var\lib\docker\volumes" : "/var/lib/docker/volumes";
            if (IsSubFolderOf(targetCanonical, Path.GetFullPath(dockerVolumePath))) return true;

            return _allowedPaths.Any(allowed => !string.IsNullOrEmpty(allowed) && IsSubFolderOf(targetCanonical, Path.GetFullPath(allowed)));
        }
        catch { return false; }
    }

    private bool IsSubFolderOf(string target, string parent)
    {
        string targetNormalized = target.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
        string parentNormalized = parent.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
        return targetNormalized.StartsWith(parentNormalized, StringComparison.OrdinalIgnoreCase);
    }

    private void ExecuteTarCommand(string sourceDir, string destinationFile)
    {
        var startInfo = new System.Diagnostics.ProcessStartInfo
        {
            FileName = "tar",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        startInfo.ArgumentList.Add("--xattrs");
        startInfo.ArgumentList.Add("--xattrs-include=user.supabase.*");
        startInfo.ArgumentList.Add("-czf");
        startInfo.ArgumentList.Add(destinationFile);
        startInfo.ArgumentList.Add("-C");
        startInfo.ArgumentList.Add(Path.GetDirectoryName(sourceDir) ?? string.Empty);
        startInfo.ArgumentList.Add(Path.GetFileName(sourceDir) ?? string.Empty);

        using var process = System.Diagnostics.Process.Start(startInfo);
        if (process == null || !process.WaitForExit(300000))
        {
            try { process?.Kill(true); } catch { }
            throw new TimeoutException("The 'tar' process timed out after 5 minutes.");
        }
        if (process.ExitCode != 0) throw new Exception($"Tar command failed: {process.StandardError.ReadToEnd() ?? "Unknown error"}");
    }

    private static string ShellQuote(string value) => $"'{value.Replace("'", "'\\''")}'";
}
