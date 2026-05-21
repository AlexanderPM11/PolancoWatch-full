using System;
using System.Collections.Generic;

namespace PolancoWatch.Domain.Models;

public class CpuMetrics
{
    public double TotalUsagePercentage { get; set; }
    public List<double> CoreUsagePercentages { get; set; } = new();
    public double[] LoadAverage { get; set; } = new double[3];
}

public class MemoryMetrics
{
    public long TotalRamBytes { get; set; }
    public long UsedRamBytes { get; set; }
    public long FreeRamBytes { get; set; }
    public double UsagePercentage { get; set; }
}

public class DiskMetrics
{
    public string MountPoint { get; set; } = string.Empty;
    public long TotalSpaceBytes { get; set; }
    public long UsedSpaceBytes { get; set; }
    public long FreeSpaceBytes { get; set; }
    public double UsagePercentage { get; set; }
}

public class NetworkMetrics
{
    public string InterfaceName { get; set; } = string.Empty;
    public long IncomingBytesPerSecond { get; set; }
    public long OutgoingBytesPerSecond { get; set; }
}

public class ProcessMetrics
{
    public int ProcessId { get; set; }
    public string Name { get; set; } = string.Empty;
    public double CpuUsagePercentage { get; set; }
    public long MemoryUsageBytes { get; set; }
}

public class DockerContainerMetrics
{
    public string ContainerId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Image { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public double CpuPercentage { get; set; }
    public long MemoryUsageBytes { get; set; }
    public string NetworkIO { get; set; } = string.Empty;
    public string BlockIO { get; set; } = string.Empty;
}

public class DockerStats
{
    public int TotalContainers { get; set; }
    public int RunningContainers { get; set; }
    public int StoppedContainers { get; set; }
    public int TotalImages { get; set; }
}

public class SystemInfoMetrics
{
    public string OsVersion { get; set; } = string.Empty;
    public string KernelVersion { get; set; } = string.Empty;
    public string Hostname { get; set; } = string.Empty;
    public TimeSpan Uptime { get; set; }
}

public class ServerMetricsSnapshot
{
    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;
    public CpuMetrics Cpu { get; set; } = new();
    public MemoryMetrics Memory { get; set; } = new();
    public List<DiskMetrics> Disks { get; set; } = new();
    public List<NetworkMetrics> Networks { get; set; } = new();
    public List<ProcessMetrics> TopProcesses { get; set; } = new();
    public List<DockerContainerMetrics> DockerContainers { get; set; } = new();
    public DockerStats DockerStats { get; set; } = new();
    public SystemInfoMetrics SystemInfo { get; set; } = new();
}
