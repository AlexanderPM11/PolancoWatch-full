using System;
using PolancoWatch.Domain.Common;

namespace PolancoWatch.Domain.Entities;

public class HistoricalMetric
{
    public int Id { get; set; }
    public DateTimeOffset Timestamp { get; set; } = TimeHelper.Now;
    public double CpuUsage { get; set; }
    public double MemoryUsage { get; set; }
    public double DiskUsage { get; set; }
}
