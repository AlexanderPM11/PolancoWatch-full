using System.Collections.Generic;
using System.Threading.Tasks;
using PolancoWatch.Domain.Entities;
using PolancoWatch.Application.DTOs;

namespace PolancoWatch.Application.Interfaces;

public interface IBackupService
{
    Task<List<string>> GetContainerDatabasesAsync(string containerId, string dbUser = "root", string? dbPass = null);
    Task DeleteBackupFileAsync(string filePath);
    bool ValidatePath(string path);
    Task RestoreDatabaseAsync(string backupId, RestoreDbRequest request);
}
