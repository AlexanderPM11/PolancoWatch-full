using System.Threading.Tasks;
using PolancoWatch.Domain.Entities;

namespace PolancoWatch.Application.Interfaces;

public interface IBackupStrategy
{
    bool CanHandle(BackupType type, string targetPath);
    Task<string> ExecuteBackupAsync(BackupContext context);
}

public class BackupContext
{
    public BackupType Type { get; set; }
    public string TargetPath { get; set; } = string.Empty;
    public BackupFormat Format { get; set; }
    public string BackupName { get; set; } = string.Empty;
    public string? DbName { get; set; }
    public string DbUser { get; set; } = "root";
    public string? DbPass { get; set; }
}
