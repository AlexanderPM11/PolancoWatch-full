using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
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

        try
        {
            var containerInfo = await _dockerClient.Containers.InspectContainerAsync(containerId);
            string image = containerInfo.Config.Image.ToLowerInvariant();
            bool isPostgres = image.Contains("postgres") || image.Contains("supabase");

            string cmd;
            if (isPostgres)
            {
                // First, check if the password is valid by fetching the passwd hash from pg_shadow.
                // We use psql locally (which trusts the connection) to fetch the hash of the user's password.
                string hashCmd = $"psql -h 127.0.0.1 -U {ShellQuote(dbUser)} -d postgres -t -c \"SELECT passwd FROM pg_shadow WHERE usename = {ShellQuote(dbUser)};\"";
                
                var hashExecParams = new ContainerExecCreateParameters
                {
                    AttachStdout = true,
                    AttachStderr = true,
                    Cmd = new[] { "sh", "-c", hashCmd }
                };

                var hashExecResponse = await _dockerClient.Exec.ExecCreateContainerAsync(containerId, hashExecParams);
                using (var hashStream = await _dockerClient.Exec.StartAndAttachContainerExecAsync(hashExecResponse.ID, false, CancellationToken.None))
                {
                    var hashRes = await hashStream.ReadOutputToEndAsync(CancellationToken.None);
                    string storedHash = hashRes.stdout?.Trim();
                    
                    if (!string.IsNullOrEmpty(storedHash) && !storedHash.Contains("error", StringComparison.OrdinalIgnoreCase))
                    {
                        if (!VerifyPostgresPassword(dbPass, dbUser, storedHash))
                        {
                            // Password is incorrect! Return empty list to simulate authentication failure.
                            return new List<string>();
                        }
                    }
                    else
                    {
                        // Fallback: If we couldn't get the hash (e.g. permission denied or pg_shadow not accessible),
                        // we try to verify the password by testing a connection via the container's bridge IP address.
                        string? hostIp = containerInfo.NetworkSettings?.Networks?.Values
                            .FirstOrDefault(n => !string.IsNullOrEmpty(n.IPAddress))?.IPAddress;
                            
                        if (!string.IsNullOrEmpty(hostIp))
                        {
                            string testCmd = $"PGPASSWORD={ShellQuote(dbPass)} psql -h {hostIp} -U {ShellQuote(dbUser)} -d postgres -t -c 'SELECT 1;'";
                            var testExecParams = new ContainerExecCreateParameters
                            {
                                AttachStdout = true,
                                AttachStderr = true,
                                Cmd = new[] { "sh", "-c", testCmd }
                            };
                            var testExecResponse = await _dockerClient.Exec.ExecCreateContainerAsync(containerId, testExecParams);
                            using (var testStream = await _dockerClient.Exec.StartAndAttachContainerExecAsync(testExecResponse.ID, false, CancellationToken.None))
                            {
                                var testRes = await testStream.ReadOutputToEndAsync(CancellationToken.None);
                                if (!string.IsNullOrEmpty(testRes.stderr) && 
                                    (testRes.stderr.Contains("password authentication failed", StringComparison.OrdinalIgnoreCase) || 
                                     testRes.stderr.Contains("authentication failed", StringComparison.OrdinalIgnoreCase)))
                                {
                                    return new List<string>();
                                }
                            }
                        }
                    }
                }

                cmd = $"PGPASSWORD={ShellQuote(dbPass)} psql -h 127.0.0.1 -U {ShellQuote(dbUser)} -t -c 'SELECT datname FROM pg_database WHERE datistemplate = false;'";
            }
            else
            {
                cmd = $"mysql -h 127.0.0.1 -u {ShellQuote(dbUser)} -p{ShellQuote(dbPass)} -e 'SHOW DATABASES;' -s --skip-column-names || mariadb -h 127.0.0.1 -u {ShellQuote(dbUser)} -p{ShellQuote(dbPass)} -e 'SHOW DATABASES;' -s --skip-column-names || mysql -u {ShellQuote(dbUser)} -p{ShellQuote(dbPass)} -e 'SHOW DATABASES;' -s --skip-column-names || mariadb -u {ShellQuote(dbUser)} -p{ShellQuote(dbPass)} -e 'SHOW DATABASES;' -s --skip-column-names";
            }

            var execParams = new ContainerExecCreateParameters
            {
                AttachStdout = true,
                AttachStderr = true,
                Cmd = new[] { "sh", "-c", cmd }
            };

            var execResponse = await _dockerClient.Exec.ExecCreateContainerAsync(containerId, execParams);
            using (var stream = await _dockerClient.Exec.StartAndAttachContainerExecAsync(execResponse.ID, false, CancellationToken.None))
            {
                var res = await stream.ReadOutputToEndAsync(CancellationToken.None);
                if (!string.IsNullOrEmpty(res.stderr))
                {
                    bool isMySqlWarning = res.stderr.Contains("Warning: Using a password", StringComparison.OrdinalIgnoreCase);
                    bool hasErrorKeyword = res.stderr.Contains("error", StringComparison.OrdinalIgnoreCase) || 
                                           res.stderr.Contains("fatal", StringComparison.OrdinalIgnoreCase);
                    
                    if (hasErrorKeyword && !isMySqlWarning)
                    {
                        return new List<string>();
                    }
                }
                
                var databases = new List<string>();
                var lines = res.stdout.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                foreach (var line in lines)
                {
                    var trimmed = line.Trim();
                    // 'postgres' user DB is valid to backup. MySQL system schemas are filtered out.
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

    private static bool VerifyPostgresPassword(string password, string username, string storedHash)
    {
        if (string.IsNullOrEmpty(storedHash)) return false;

        if (storedHash.StartsWith("md5", StringComparison.OrdinalIgnoreCase))
        {
            using (var md5 = MD5.Create())
            {
                byte[] bytes = Encoding.UTF8.GetBytes(password + username);
                byte[] hashBytes = md5.ComputeHash(bytes);
                var sb = new StringBuilder("md5");
                foreach (var b in hashBytes)
                {
                    sb.Append(b.ToString("x2"));
                }
                return sb.ToString().Equals(storedHash, StringComparison.OrdinalIgnoreCase);
            }
        }

        if (storedHash.StartsWith("SCRAM-SHA-256$", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                var parts = storedHash.Substring("SCRAM-SHA-256$".Length).Split('$');
                if (parts.Length < 2) return false;

                var iterSalt = parts[0].Split(':');
                if (iterSalt.Length < 2) return false;

                int iterations = int.Parse(iterSalt[0]);
                byte[] salt = Convert.FromBase64String(iterSalt[1]);

                var keys = parts[1].Split(':');
                string expectedStoredKeyBase64 = keys[0];

                byte[] passwordBytes = Encoding.UTF8.GetBytes(password);
                
                byte[] saltedPassword;
                using (var pbkdf2 = new Rfc2898DeriveBytes(passwordBytes, salt, iterations, HashAlgorithmName.SHA256))
                {
                    saltedPassword = pbkdf2.GetBytes(32);
                }

                byte[] clientKey;
                using (var hmac = new HMACSHA256(saltedPassword))
                {
                    clientKey = hmac.ComputeHash(Encoding.UTF8.GetBytes("Client Key"));
                }

                byte[] storedKey;
                using (var sha256 = SHA256.Create())
                {
                    storedKey = sha256.ComputeHash(clientKey);
                }

                string actualStoredKeyBase64 = Convert.ToBase64String(storedKey);
                return expectedStoredKeyBase64.Equals(actualStoredKeyBase64);
            }
            catch
            {
                return false;
            }
        }

        return password.Equals(storedHash);
    }
}
