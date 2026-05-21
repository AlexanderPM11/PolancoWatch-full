using System;
using System.ComponentModel.DataAnnotations;

namespace PolancoWatch.Domain.Entities;

public class BackupSchedule
{
    public Guid Id { get; set; } = Guid.NewGuid();
    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    public BackupType Type { get; set; }
    [MaxLength(1024)]
    public string Target { get; set; } = string.Empty; // Volume name or directory path
    public BackupFormat Format { get; set; } = BackupFormat.Zip;
    // Legacy scheduling
    public int IntervalMinutes { get; set; }
    
    // Advanced scheduling
    public bool UseCron { get; set; } = false;
    [MaxLength(100)]
    public string? CronExpression { get; set; } // Format: "0 14 * * *" (Daily at 14:00)
    
    public bool IsActive { get; set; } = true;
    public DateTimeOffset? NextRun { get; set; }
    public DateTimeOffset? LastRun { get; set; }
    
    // Cloud Sync Configuration per schedule
    public bool SyncToCloud { get; set; } = false;
    [MaxLength(512)]
    public string? CloudFolderId { get; set; }
    public bool KeepLocal { get; set; } = true;
    public int RetentionCount { get; set; } = 0; // 0 means keep all
    public bool SendTelegram { get; set; } = false;
}
