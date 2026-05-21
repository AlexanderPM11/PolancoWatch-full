using System;
using System.ComponentModel.DataAnnotations;

namespace PolancoWatch.Domain.Entities;

public enum WebMonitorStatus
{
    Up = 0,
    Checking = 1,
    Down = 2,
    Slow = 3
}

public class WebMonitor
{
    public int Id { get; set; }
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    [MaxLength(2048)]
    public string Url { get; set; } = string.Empty;
    public int CheckIntervalSeconds { get; set; } = 60;
    public bool IsActive { get; set; } = true;
    public DateTimeOffset? LastCheckTime { get; set; }
    public bool LastStatusUp { get; set; } = true;
    public WebMonitorStatus Status { get; set; } = WebMonitorStatus.Up;
    public double LastLatencyMs { get; set; }
    public int SlowThresholdMs { get; set; } = 5000;
    public bool NotifyOnSlow { get; set; } = true;
    public bool Notify { get; set; } = true;
}
