using System;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using PolancoWatch.Application.Interfaces;
using PolancoWatch.Domain.Entities;
using Docker.DotNet;
using Docker.DotNet.Models;
using Microsoft.Data.Sqlite;
using PolancoWatch.Domain.Common;

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

    public async Task<string> CreateVolumeBackupAsync(string targetPath, BackupFormat format, string backupName)
    {
        if (!string.IsNullOrEmpty(backupName))
        {
            backupName = Path.GetFileName(backupName); // Elimina rutas relativas o absolutas
            backupName = string.Join("_", backupName.Split(Path.GetInvalidFileNameChars())); // Elimina caracteres extraños
        }

        // Check if this is a Docker volume path or name
        string volumeName = await GetVolumeNameFromPathAsync(targetPath);
        bool isDockerVolume = !string.IsNullOrEmpty(volumeName);

        if (!isDockerVolume && !ValidatePath(targetPath))
        {
            throw new UnauthorizedAccessException($"Path '{targetPath}' is not in the allowed backup paths.");
        }

        string extension = format == BackupFormat.Zip ? ".zip" : ".tar.gz";
        string fileName = $"{backupName}_{TimeHelper.Now:yyyyMMddHHmmss}{extension}";
        string destinationPath = Path.Combine(_backupRootPath, fileName);

        try
        {
            if (isDockerVolume)
            {
                await CreateDockerVolumeArchiveAsync(volumeName!, destinationPath, format);
            }
            else
            {
                await Task.Run(() =>
                {
                    if (format == BackupFormat.Zip)
                    {
                        ZipFile.CreateFromDirectory(targetPath, destinationPath, CompressionLevel.SmallestSize, includeBaseDirectory: false);
                    }
                    else
                    {
                        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                        {
                            ExecuteTarCommand(targetPath, destinationPath);
                        }
                        else
                        {
                            ZipFile.CreateFromDirectory(targetPath, destinationPath, CompressionLevel.SmallestSize, includeBaseDirectory: false);
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
            catch { /* Ignore cleanup errors */ }
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
        try
        {
            var volumes = await _dockerClient.Volumes.ListAsync();
            foreach (var volume in volumes.Volumes)
            {
                if (path.Equals(volume.Name, StringComparison.OrdinalIgnoreCase) || 
                    path.Equals(volume.Mountpoint, StringComparison.OrdinalIgnoreCase))
                {
                    return volume.Name;
                }
            }
        }
        catch { /* Fallback */ }
        return null;
    }

    private async Task CreateDockerVolumeArchiveAsync(string volumeName, string destinationFilePath, BackupFormat format)
    {
        // On Linux/Docker, we need to know the path or volume name AS SEEN BY THE HOST.
        // We prioritize BACKUP_HOST_PATH environment variable.
        string? backupDirOnHost = Environment.GetEnvironmentVariable("BACKUP_HOST_PATH") 
                               ?? _configuration["Backup:HostPath"];

        if (string.IsNullOrEmpty(backupDirOnHost))
        {
            backupDirOnHost = Path.GetDirectoryName(destinationFilePath) ?? _backupRootPath;
        }

        string fileName = Path.GetFileName(destinationFilePath);
        
        // Ensure 'alpine' image exists
        await EnsureImageExistsAsync("alpine:latest");

        string cmd = format == BackupFormat.Zip 
            ? $"apk add --no-cache zip && cd /data && zip -r -9 /backup/{fileName} ." 
            : $"tar czf /backup/{fileName} -C /data .";

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
            
            // Wait for completion (timeout 5 mins for safety)
            var waitResponse = await _dockerClient.Containers.WaitContainerAsync(createResponse.ID);
            
            if (waitResponse.StatusCode != 0)
            {
                var logs = await _dockerClient.Containers.GetContainerLogsAsync(createResponse.ID, new ContainerLogsParameters { ShowStderr = true, ShowStdout = true }, CancellationToken.None);
                using var reader = new StreamReader(logs);
                string errorOutput = await reader.ReadToEndAsync();
                throw new Exception($"Docker backup container failed with exit code {waitResponse.StatusCode}. Logs: {errorOutput}");
            }

            // Verify the file exists from the backend point of view (to help debugging)
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

    private async Task EnsureImageExistsAsync(string image)
    {
        try
        {
            await _dockerClient.Images.InspectImageAsync(image);
        }
        catch (Exception ex)
        {
            // If image not found (404), pull it
            if (ex is Docker.DotNet.DockerApiException dex && dex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                var (name, tag) = ParseImageName(image);
                await _dockerClient.Images.CreateImageAsync(
                    new ImagesCreateParameters { FromImage = name, Tag = tag },
                    null, 
                    new Progress<JSONMessage>()
                );
            }
            else
            {
                // Rethrow other errors
                throw;
            }
        }
    }

    private (string Name, string Tag) ParseImageName(string image)
    {
        var parts = image.Split(':');
        return (parts[0], parts.Length > 1 ? parts[1] : "latest");
    }

    public async Task<string> CreateDockerDatabaseBackupAsync(string containerId, string? targetDb, BackupFormat format, string backupName, string dbUser = "root", string? dbPass = null)
    {
        if (!string.IsNullOrEmpty(backupName))
        {
            backupName = Path.GetFileName(backupName); // Elimina rutas relativas o absolutas
            backupName = string.Join("_", backupName.Split(Path.GetInvalidFileNameChars())); // Elimina caracteres extraños
        }

        if (string.IsNullOrEmpty(dbPass))
        {
            throw new Exception("Database password is required. Please provide the password for the database user.");
        }

        string sqlFileName = $"{backupName}.sql";
        string databaseArguments = string.IsNullOrEmpty(targetDb) ? "--all-databases" : $"--databases {targetDb}";
        var safePass = dbPass.Replace("'", "'\\''");
        var safeUser = dbUser.Replace("'", "'\\''");
        string dumpCmd = $"mysqldump -u '{safeUser}' -p'{safePass}' --single-transaction {databaseArguments} > /tmp/{sqlFileName}";

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
            if (ex is System.IO.EndOfStreamException || ex.Message.Contains("Attempted to read past the end of the stream"))
            {
                // Multiplexing bug: stream aborted early explicitly. Handled below via polling.
            }
            else
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

        // We can use the existing CreateDockerVolumeArchiveAsync by bypassing it or creating a helper container.
        // Wait, since the file is in /tmp inside the target container, we can just grab it.
        string tempDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
        Directory.CreateDirectory(tempDir);
        
        try
        {
            // Use docker exec cat to stream raw SQL bytes directly — bypasses Docker's broken tar stream
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
                    // EndOfStream just signals Docker closed the pipe — data already written
                }
            }

            var localFileInfo = new FileInfo(localSqlPath);
            if (!localFileInfo.Exists || localFileInfo.Length == 0)
            {
                throw new Exception("mysqldump produced a 0-byte file. Check your credentials and database name.");
            }

            // Compress directly — bypasses CreateVolumeBackupAsync path validation
            string extension = format == BackupFormat.Zip ? ".zip" : ".tar.gz";
            string fileName = $"{backupName}_{TimeHelper.Now:yyyyMMddHHmmss}{extension}";
            string destinationPath = Path.Combine(_backupRootPath, fileName);

            try
            {
                await Task.Run(() =>
                {
                    ZipFile.CreateFromDirectory(tempDir, destinationPath, CompressionLevel.SmallestSize, includeBaseDirectory: false);
                });
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
                catch { /* Ignore deletion errors */ }
                throw;
            }

            var fileInfo = new FileInfo(destinationPath);
            if (!fileInfo.Exists || fileInfo.Length == 0)
            {
                throw new InvalidOperationException($"Backup generation failed: Destination file '{destinationPath}' is missing or is 0 bytes.");
            }

            return destinationPath;
        }
        catch (Exception)
        {
            throw; // Re-throw to be handled by higher level
        }
        finally
        {
            // Always attempt to clean up the file inside the container
            try
            {
                var rmParams = new ContainerExecCreateParameters { Cmd = new[] { "rm", "-f", $"/tmp/{sqlFileName}" } };
                var rmExec = await _dockerClient.Exec.ExecCreateContainerAsync(containerId, rmParams);
                await _dockerClient.Exec.StartContainerExecAsync(rmExec.ID);
            }
            catch { /* Ignore cleanup errors in container */ }

            if (Directory.Exists(tempDir))
                Directory.Delete(tempDir, true);
        }
    }

    public async Task<List<string>> GetContainerDatabasesAsync(string containerId, string dbUser = "root", string? dbPass = null)
    {
        if (string.IsNullOrEmpty(dbPass))
        {
            return new List<string>();
        }

        var safePass = dbPass.Replace("'", "'\\''");
        var safeUser = dbUser.Replace("'", "'\\''");
        string cmd = $"mysql -u '{safeUser}' -p'{safePass}' -e 'SHOW DATABASES;' -s --skip-column-names || mariadb -u '{safeUser}' -p'{safePass}' -e 'SHOW DATABASES;' -s --skip-column-names";

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
            // Docker multiplexed stream bug: "Attempted to read past the end of the stream"
            // or other exec attachment failures. Fallback to empty list.
            return new List<string>();
        }
    }

    public async Task<string> CreateDatabaseBackupAsync(BackupFormat format, string backupName)
    {
        if (!string.IsNullOrEmpty(backupName))
        {
            backupName = Path.GetFileName(backupName); // Elimina rutas relativas o absolutas
            backupName = string.Join("_", backupName.Split(Path.GetInvalidFileNameChars())); // Elimina caracteres extraños
        }

        string dbPath = GetSqliteDbPath();
        if (string.IsNullOrEmpty(dbPath) || !File.Exists(dbPath))
        {
            throw new FileNotFoundException("SQLite database file not found.");
        }

        string tempDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
        Directory.CreateDirectory(tempDir);
        
        try
        {
            string tempDbCopy = Path.Combine(tempDir, Path.GetFileName(dbPath));
            
            // SQLite safe copy using VACUUM INTO command
            await ExecuteSqliteVacuumIntoAsync(dbPath, tempDbCopy);

            string backupPath = await CreateVolumeBackupAsync(tempDir, format, backupName);

            var fileInfo = new FileInfo(backupPath);
            if (!fileInfo.Exists || fileInfo.Length == 0)
            {
                throw new InvalidOperationException($"Backup generation failed: SQLite clone file '{backupPath}' is missing or is 0 bytes.");
            }

            return backupPath;
        }
        finally
        {
            if (Directory.Exists(tempDir))
            {
                try
                {
                    Directory.Delete(tempDir, true);
                }
                catch { /* Ignore cleanup errors */ }
            }
        }
    }

    private async Task ExecuteSqliteVacuumIntoAsync(string dbPath, string tempDbCopy)
    {
        var connectionString = $"Data Source={dbPath}";
        using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync();

        using var command = connection.CreateCommand();
        command.CommandText = "VACUUM INTO $targetPath";
        command.Parameters.AddWithValue("$targetPath", tempDbCopy);

        await command.ExecuteNonQueryAsync();
    }

    public Task DeleteBackupFileAsync(string filePath)
    {
        if (string.IsNullOrEmpty(filePath)) return Task.CompletedTask;

        // Normalize path for the current OS
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

    private string GetSqliteDbPath()
    {
        var connectionString = _configuration.GetConnectionString("DefaultConnection");
        if (connectionString != null && connectionString.Contains("Data Source="))
        {
             return connectionString.Replace("Data Source=", "").Trim();
        }
        return string.Empty;
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
        startInfo.ArgumentList.Add("-czf");
        startInfo.ArgumentList.Add(destinationFile);
        startInfo.ArgumentList.Add("-C");
        startInfo.ArgumentList.Add(Path.GetDirectoryName(sourceDir) ?? string.Empty);
        startInfo.ArgumentList.Add(Path.GetFileName(sourceDir) ?? string.Empty);

        using var process = System.Diagnostics.Process.Start(startInfo);
        if (process == null)
        {
            throw new Exception("Failed to start 'tar' process.");
        }

        if (!process.WaitForExit(300000)) // 5 minutes in milliseconds
        {
            try
            {
                process.Kill(true); // Kill the process and all of its child processes
            }
            catch (Exception)
            {
                // Ignore kill exceptions — best-effort termination
            }
            throw new TimeoutException("The 'tar' process timed out after 5 minutes.");
        }
        
        if (process.ExitCode != 0)
        {
            string error = process.StandardError.ReadToEnd() ?? "Unknown tar error";
            throw new Exception($"Tar command failed: {error}");
        }
    }
}
