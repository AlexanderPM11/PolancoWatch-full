using System;
using System.IO;
using System.Linq;
using System.Formats.Tar;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using PolancoWatch.Application.Interfaces;
using PolancoWatch.Domain.Entities;
using Docker.DotNet;
using Docker.DotNet.Models;

namespace PolancoWatch.Infrastructure.Services.RestoreStrategies;

public class WordPressDatabaseRestoreStrategy : IRestoreStrategy
{
    private readonly IDockerClient _dockerClient;
    private readonly ILogger<WordPressDatabaseRestoreStrategy> _logger;

    public WordPressDatabaseRestoreStrategy(IDockerClient dockerClient, ILogger<WordPressDatabaseRestoreStrategy> logger)
    {
        _dockerClient = dockerClient;
        _logger = logger;
    }

    public bool CanHandle(RestoreType type)
    {
        return type == RestoreType.WordPressDatabase;
    }

    public async Task ExecuteRestoreAsync(RestoreContext context)
    {
        string containerId = await ResolveContainerIdAsync(context.TargetContainer);
        
        var fileInfo = new FileInfo(context.FilePath);
        if (!fileInfo.Exists)
        {
            throw new FileNotFoundException($"Uploaded restore file not found at {context.FilePath}");
        }

        if (string.IsNullOrEmpty(context.DbName) || string.IsNullOrEmpty(context.DbPass))
        {
            throw new Exception("Database Name and Database Password are required for WordPress Database restoration.");
        }

        string tempTarPath = Path.GetTempFileName();
        try
        {
            using (var tarStream = new FileStream(tempTarPath, FileMode.Create, FileAccess.Write))
            {
                using var writer = new TarWriter(tarStream, TarEntryFormat.Pax, leaveOpen: true);
                var entry = new PaxTarEntry(TarEntryType.RegularFile, "restore.sql")
                {
                    DataStream = new FileStream(context.FilePath, FileMode.Open, FileAccess.Read)
                };
                await writer.WriteEntryAsync(entry);
            }

            using (var tarStreamToUpload = new FileStream(tempTarPath, FileMode.Open, FileAccess.Read))
            {
                await _dockerClient.Containers.ExtractArchiveToContainerAsync(containerId, new ContainerPathStatParameters
                {
                    Path = "/tmp",
                    AllowOverwriteDirWithFile = true
                }, tarStreamToUpload, CancellationToken.None);
            }
        }
        finally
        {
            if (File.Exists(tempTarPath)) File.Delete(tempTarPath);
        }

        string dbUser = string.IsNullOrEmpty(context.DbUser) ? "root" : context.DbUser;

        _logger.LogInformation("Injecting SQL restore into WordPress DB...");
        string cmd = $"mysql -u {dbUser} -p'{context.DbPass.Replace("'", "'\\''")}' {context.DbName} < /tmp/restore.sql";
        await RunExecCommandAsync(containerId, new[] { "sh", "-c", cmd });

        await RunExecCommandAsync(containerId, new[] { "rm", "-f", "/tmp/restore.sql" });
    }

    private async Task RunExecCommandAsync(string containerId, string[] cmd)
    {
        var execParams = new ContainerExecCreateParameters
        {
            AttachStdout = true,
            AttachStderr = true,
            Cmd = cmd
        };

        var execResponse = await _dockerClient.Exec.ExecCreateContainerAsync(containerId, execParams);
        using (var stream = await _dockerClient.Exec.StartAndAttachContainerExecAsync(execResponse.ID, false, CancellationToken.None))
        {
            var res = await stream.ReadOutputToEndAsync(CancellationToken.None);
            if (!string.IsNullOrEmpty(res.stderr) && !res.stderr.Contains("Warning: Using a password", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Command warning/error: {Stderr}", res.stderr);
                if (res.stderr.Contains("ERROR", StringComparison.OrdinalIgnoreCase))
                {
                    throw new Exception($"MySQL restore failed: {res.stderr}");
                }
            }
        }
    }

    private async Task<string> ResolveContainerIdAsync(string target)
    {
        var containers = await _dockerClient.Containers.ListContainersAsync(new ContainersListParameters { All = true });
        var matched = containers.FirstOrDefault(c => c.Names != null && c.Names.Any(n => n.TrimStart('/') == target || n == target));
        if (matched != null) return matched.ID;
        throw new Exception($"Container not found: {target}");
    }
}
