using System;
using PolancoWatch.Domain.Common;

namespace PolancoWatch.Domain.Entities;

public class Backup
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public BackupType Type { get; set; }
    public BackupFormat Format { get; set; }
    public string? FilePath { get; set; }
    public long Size { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = TimeHelper.Now;
    public BackupStatus Status { get; set; }
    public string? ErrorMessage { get; set; }
    
    // Cloud Sync
    public CloudSyncStatus CloudSyncStatus { get; set; } = CloudSyncStatus.NotSynced;
    public string? CloudFileId { get; set; }
    public string? CloudLink { get; set; }
}
