using System;
using PolancoWatch.Domain.Common;

namespace PolancoWatch.Domain.Entities;

public class Restore
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public RestoreType Type { get; set; }
    public string TargetContainer { get; set; } = string.Empty;
    public string? FilePath { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = TimeHelper.Now;
    public DateTimeOffset? CompletedAt { get; set; }
    public RestoreStatus Status { get; set; } = RestoreStatus.Pending;
    public string? ErrorMessage { get; set; }
}
