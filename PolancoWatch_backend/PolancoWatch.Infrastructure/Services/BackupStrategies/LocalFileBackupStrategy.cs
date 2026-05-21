using System;
using System.IO;
using System.IO.Compression;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using PolancoWatch.Application.Interfaces;
using PolancoWatch.Domain.Entities;
using PolancoWatch.Domain.Common;
using Microsoft.Data.Sqlite;

namespace PolancoWatch.Infrastructure.Services.BackupStrategies;

public class LocalFileBackupStrategy : IBackupStrategy
{
    private readonly IConfiguration _configuration;
    private readonly string _backupRootPath;

    public LocalFileBackupStrategy(IConfiguration configuration)
    {
        _configuration = configuration;
        string root = configuration["Backup:RootPath"] ?? Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "backups");
        _backupRootPath = Path.GetFullPath(root);

        if (!Directory.Exists(_backupRootPath))
        {
            Directory.CreateDirectory(_backupRootPath);
        }
    }

    public bool CanHandle(BackupType type, string targetPath)
    {
        return type == BackupType.Database && string.IsNullOrEmpty(targetPath);
    }

    public async Task<string> ExecuteBackupAsync(BackupContext context)
    {
        string backupName = context.BackupName;
        if (!string.IsNullOrEmpty(backupName))
        {
            backupName = Path.GetFileName(backupName);
            backupName = string.Join("_", backupName.Split(Path.GetInvalidFileNameChars()));
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
            await ExecuteSqliteVacuumIntoAsync(dbPath, tempDbCopy);

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
                throw new InvalidOperationException($"Backup generation failed: SQLite clone file '{destinationPath}' is missing or is 0 bytes.");
            }

            return destinationPath;
        }
        finally
        {
            if (Directory.Exists(tempDir))
            {
                try { Directory.Delete(tempDir, true); } catch { }
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

    private string GetSqliteDbPath()
    {
        var connectionString = _configuration.GetConnectionString("DefaultConnection");
        if (connectionString != null && connectionString.Contains("Data Source="))
        {
             return connectionString.Replace("Data Source=", "").Trim();
        }
        return string.Empty;
    }
}
