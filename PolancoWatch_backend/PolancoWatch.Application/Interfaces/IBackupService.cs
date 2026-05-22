using System.Collections.Generic;
using System.Threading.Tasks;
using PolancoWatch.Domain.Entities;

namespace PolancoWatch.Application.Interfaces;

public interface IBackupService
{
    Task<List<string>> GetContainerDatabasesAsync(string containerId, string dbUser = "root", string? dbPass = null);
    Task DeleteBackupFileAsync(string filePath);
    bool ValidatePath(string path);
}

