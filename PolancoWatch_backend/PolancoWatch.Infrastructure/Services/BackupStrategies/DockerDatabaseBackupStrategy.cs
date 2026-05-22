using System;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using PolancoWatch.Application.Interfaces;
using PolancoWatch.Domain.Entities;
using PolancoWatch.Domain.Common;
using Docker.DotNet;
using Docker.DotNet.Models;

namespace PolancoWatch.Infrastructure.Services.BackupStrategies;

public class DockerDatabaseBackupStrategy : IBackupStrategy
{
    private readonly IDockerClient _dockerClient;
    private readonly string _backupRootPath;

    public DockerDatabaseBackupStrategy(IConfiguration configuration, IDockerClient dockerClient)
    {
        _dockerClient = dockerClient;
        string root = configuration["Backup:RootPath"] ?? Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "backups");
        _backupRootPath = Path.GetFullPath(root);
    }

    public bool CanHandle(BackupType type, string targetPath)
    {
        return type == BackupType.Database && !string.IsNullOrEmpty(targetPath);
    }

    public async Task<string> ExecuteBackupAsync(BackupContext context)
    {
        string containerId = await ResolveContainerIdAsync(context.TargetPath);

        string backupName = context.BackupName;
        if (!string.IsNullOrEmpty(backupName))
        {
            backupName = Path.GetFileName(backupName);
            backupName = string.Join("_", backupName.Split(Path.GetInvalidFileNameChars()));
        }

        if (string.IsNullOrEmpty(context.DbPass))
        {
            throw new Exception("Database password is required. Please provide the password for the database user.");
        }

        string sqlFileName = $"{backupName}.sql";
        string databaseArguments = string.IsNullOrEmpty(context.DbName)
            ? "--all-databases"
            : $"--databases {ShellQuote(ValidateDatabaseName(context.DbName))}";
        string dumpCmd = $"mysqldump -u {ShellQuote(context.DbUser)} -p{ShellQuote(context.DbPass)} --single-transaction {databaseArguments} > {ShellQuote($"/tmp/{sqlFileName}")}";

        var execParams = new ContainerExecCreateParameters
        {
            AttachStdout = true,
            AttachStderr = true,
            Cmd = new[] { "sh", "-c", dumpCmd }
        };

        string? execId = null;
        try
        {
            var execResponse = await _dockerClient.Exec.ExecCreateContainerAsync(containerId, execParams);
            execId = execResponse.ID;
            using (var stream = await _dockerClient.Exec.StartAndAttachContainerExecAsync(execResponse.ID, false, CancellationToken.None))
            {
                var res = await stream.ReadOutputToEndAsync(CancellationToken.None);
                if (!string.IsNullOrEmpty(res.stderr) && res.stderr.Contains("error", StringComparison.OrdinalIgnoreCase) && !res.stderr.Contains("Warning: Using a password", StringComparison.OrdinalIgnoreCase))
                {
                    throw new Exception($"mysqldump failed: {res.stderr}");
                }
            }
        }
        catch (Exception ex)
        {
            if (!(ex is System.IO.EndOfStreamException || ex.Message.Contains("Attempted to read past the end of the stream")))
            {
                throw;
            }
        }

        if (!string.IsNullOrEmpty(execId))
        {
            var inspect = await _dockerClient.Exec.InspectContainerExecAsync(execId);
            int attempts = 0;
            while (inspect.Running && attempts < 120) // wait up to 60s
            {
                await Task.Delay(500);
                inspect = await _dockerClient.Exec.InspectContainerExecAsync(execId);
                attempts++;
            }

            if (inspect.Running || inspect.ExitCode != 0)
            {
                throw new Exception($"mysqldump failed or timed out. Exit code: {inspect.ExitCode}");
            }
        }

        string tempDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
        Directory.CreateDirectory(tempDir);
        
        try
        {
            var catParams = new ContainerExecCreateParameters
            {
                AttachStdout = true,
                AttachStderr = false,
                Cmd = new[] { "cat", $"/tmp/{sqlFileName}" }
            };
            var catExec = await _dockerClient.Exec.ExecCreateContainerAsync(containerId, catParams);
            string localSqlPath = Path.Combine(tempDir, sqlFileName);

            using (var catStream = await _dockerClient.Exec.StartAndAttachContainerExecAsync(catExec.ID, false, CancellationToken.None))
            using (var fileStream = new FileStream(localSqlPath, FileMode.Create, FileAccess.Write))
            {
                var buffer = new byte[81920];
                try
                {
                    var readResult = await catStream.ReadOutputAsync(buffer, 0, buffer.Length, CancellationToken.None);
                    while (readResult.Count > 0)
                    {
                        await fileStream.WriteAsync(buffer, 0, readResult.Count, CancellationToken.None);
                        readResult = await catStream.ReadOutputAsync(buffer, 0, buffer.Length, CancellationToken.None);
                    }
                }
                catch (Exception ex)
                {
                    if (!(ex is System.IO.EndOfStreamException || ex.Message.Contains("Attempted to read past the end of the stream")))
                        throw;
                }
            }

            var localFileInfo = new FileInfo(localSqlPath);
            if (!localFileInfo.Exists || localFileInfo.Length == 0)
            {
                throw new Exception("mysqldump produced a 0-byte file. Check your credentials and database name.");
            }

            string extension = context.Format == BackupFormat.Zip ? ".zip" : ".tar.gz";
            string fileName = $"{backupName}_{TimeHelper.Now:yyyyMMddHHmmss}{extension}";
            string destinationPath = Path.Combine(_backupRootPath, fileName);

            await Task.Run(() =>
            {
                ZipFile.CreateFromDirectory(tempDir, destinationPath, CompressionLevel.SmallestSize, includeBaseDirectory: false);
            });

            var fileInfo = new FileInfo(destinationPath);
            if (!fileInfo.Exists || fileInfo.Length == 0)
            {
                throw new InvalidOperationException($"Backup generation failed: Destination file '{destinationPath}' is missing or is 0 bytes.");
            }

            return destinationPath;
        }
        finally
        {
            try
            {
                var rmParams = new ContainerExecCreateParameters { Cmd = new[] { "rm", "-f", $"/tmp/{sqlFileName}" } };
                var rmExec = await _dockerClient.Exec.ExecCreateContainerAsync(containerId, rmParams);
                await _dockerClient.Exec.StartContainerExecAsync(rmExec.ID);
            }
            catch { }

            if (Directory.Exists(tempDir))
                Directory.Delete(tempDir, true);
        }
    }

    private static string ValidateDatabaseName(string databaseName)
    {
        var trimmed = databaseName.Trim();
        if (!Regex.IsMatch(trimmed, @"^[A-Za-z0-9_$-]+$"))
        {
            throw new ArgumentException("Database name contains unsupported characters.");
        }

        return trimmed;
    }

    private static string ShellQuote(string value)
    {
        return $"'{value.Replace("'", "'\\''")}'";
    }

    private async Task<string> ResolveContainerIdAsync(string target)
    {
        try
        {
            var container = await _dockerClient.Containers.InspectContainerAsync(target);
            return container.ID;
        }
        catch (DockerContainerNotFoundException)
        {
            // Ignore and try by name
        }
        catch (DockerApiException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            // Ignore and try by name
        }

        var containers = await _dockerClient.Containers.ListContainersAsync(new ContainersListParameters { All = true });
        var matched = containers.FirstOrDefault(c => c.Names != null && c.Names.Any(n => n.TrimStart('/') == target || n == target));

        if (matched != null)
        {
            return matched.ID;
        }

        throw new Exception($"Container not found by ID or Name: {target}");
    }
}
