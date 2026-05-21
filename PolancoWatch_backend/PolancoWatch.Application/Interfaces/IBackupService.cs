using System.Collections.Generic;
using System.Threading.Tasks;
using PolancoWatch.Domain.Entities;

namespace PolancoWatch.Application.Interfaces;

public interface IBackupService
{
    Task<string> CreateVolumeBackupAsync(string targetPath, BackupFormat format, string backupName);
    Task<string> CreateDatabaseBackupAsync(BackupFormat format, string backupName);
    Task<string> CreateDockerDatabaseBackupAsync(string containerId, string? targetDb, BackupFormat format, string backupName, string dbUser = "root", string? dbPass = null);
    Task<List<string>> GetContainerDatabasesAsync(string containerId, string dbUser = "root", string? dbPass = null);
    Task DeleteBackupFileAsync(string filePath);
    bool ValidatePath(string path);
}
