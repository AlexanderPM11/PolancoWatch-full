using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Diagnostics;
using System.Linq;
using System.Runtime.InteropServices;
using Microsoft.Extensions.Logging;
using PolancoWatch.Application.Interfaces;
using PolancoWatch.Domain.Models;
using Docker.DotNet;
using Docker.DotNet.Models;
using System.Management;

using PolancoWatch.Domain.Common;

namespace PolancoWatch.Infrastructure.Services;

#pragma warning disable CA1416
public class SystemMetricsCollector : IMetricsCollector
{
    // CPU Tick Persistence (Linux)
    private Dictionary<string, (ulong Total, ulong Idle)> _prevLinuxCpuTimes = new();

    private readonly ILogger<SystemMetricsCollector> _logger;
    private readonly IDockerClient? _dockerClient;
    private PerformanceCounter? _winCpuCounter;
    private PerformanceCounter? _winMemCounter;

    // Static & Instance Caching
    private static SystemInfoMetrics? _cachedSystemInfo;
    
    // Docker Caching
    private List<DockerContainerMetrics> _lastDockerContainers = new();
    private DateTime _lastDockerListTime = DateTime.MinValue;
    private readonly TimeSpan _dockerCacheTtl = TimeSpan.FromSeconds(5);
    private bool _isDockerUpdating = false;
    private DockerStats _cachedDockerStats = new DockerStats();

    // Linux Process Caching
    private bool _isProcessUpdating = false;
    private DateTime _lastProcessListTime = DateTime.MinValue;
    private readonly TimeSpan _processCacheTtl = TimeSpan.FromSeconds(10);
    private List<ProcessMetrics> _lastProcessList = new();

    // Performance Counters for Core Metrics (Windows)
    private List<PerformanceCounter> _winCoreCounters = new();

    public SystemMetricsCollector(ILogger<SystemMetricsCollector> logger, IDockerClient? dockerClient)
    {
        _logger = logger;
        _dockerClient = dockerClient;

        if (OperatingSystem.IsWindows())
        {
            try {
                _winCpuCounter = new PerformanceCounter("Processor", "% Processor Time", "_Total");
                _winCpuCounter.NextValue();
                
                _winMemCounter = new PerformanceCounter("Memory", "Available Bytes");
            } catch (Exception) { }
        }
    }


    public async Task<ServerMetricsSnapshot> CollectMetricsAsync()
    {
        var snapshot = new ServerMetricsSnapshot();
        var tasks = new List<Task>();

        if (OperatingSystem.IsLinux())
        {
            tasks.Add(ParseCpuLinuxAsync(snapshot.Cpu));
            tasks.Add(ParseMemoryLinuxAsync(snapshot.Memory));
            tasks.Add(ParseNetworkLinuxAsync(snapshot.Networks));
            tasks.Add(ParseSystemInfoLinuxAsync(snapshot.SystemInfo));
            tasks.Add(ParseDiskAsync(snapshot.Disks));
            tasks.Add(ParseProcessesLinuxAsync(snapshot.TopProcesses));
        }
        else if (OperatingSystem.IsWindows())
        {
            tasks.Add(ParseCpuWindowsAsync(snapshot.Cpu));
            tasks.Add(ParseMemoryWindowsAsync(snapshot.Memory));
            tasks.Add(ParseNetworkWindowsAsync(snapshot.Networks));
            tasks.Add(ParseSystemInfoWindowsAsync(snapshot.SystemInfo));
            tasks.Add(ParseDiskAsync(snapshot.Disks));
            tasks.Add(ParseProcessesWindowsAsync(snapshot.TopProcesses));
        }

        tasks.Add(ParseDockerAsync(snapshot));

        await Task.WhenAll(tasks);

        return snapshot;
    }

    public async Task<(bool Success, string Message)> KillProcessAsync(int pid)
    {
        try
        {
            var process = Process.GetProcessById(pid);
            process.Kill(true); // Kill entire process tree
            await process.WaitForExitAsync();
            return (true, $"Process {pid} ({process.ProcessName}) terminated successfully.");
        }
        catch (ArgumentException)
        {
            return (false, $"Process {pid} was not found. It may have already exited.");
        }
        catch (System.ComponentModel.Win32Exception ex) when (ex.NativeErrorCode == 5) // Access Denied
        {
            return (false, "Access Denied. PolancoWatch does not have sufficient permissions to terminate this process. Try running the service as Administrator/Root.");
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"Failed to kill process {pid}: {ex.Message}");
            return (false, $"System Error: {ex.Message}");
        }
    }


    private async Task ParseCpuWindowsAsync(CpuMetrics metric)
    {
        if (_winCpuCounter != null)
        {
            metric.TotalUsagePercentage = Math.Round(_winCpuCounter.NextValue(), 2);
            
            // Initialize core counters if not already done
            if (!_winCoreCounters.Any())
            {
                try {
                    var category = new PerformanceCounterCategory("Processor");
                    var instances = category.GetInstanceNames()
                        .Where(i => i != "_Total" && i != "Idle")
                        .OrderBy(i => i);
                    
                    foreach (var instance in instances)
                    {
                        var pc = new PerformanceCounter("Processor", "% Processor Time", instance);
                        pc.NextValue(); // First call
                        _winCoreCounters.Add(pc);
                    }
                } catch { }
            }

            // Collect core usage
            metric.CoreUsagePercentages.Clear();
            foreach (var pc in _winCoreCounters)
            {
                metric.CoreUsagePercentages.Add(Math.Round(pc.NextValue(), 2));
            }
        }
        await Task.CompletedTask;
    }

    private async Task ParseMemoryWindowsAsync(MemoryMetrics metric)
    {
        if (OperatingSystem.IsWindows())
        {
            try
            {
                using var searcher = new ManagementObjectSearcher("SELECT TotalPhysicalMemory FROM Win32_ComputerSystem");
                foreach (var obj in searcher.Get())
                {
                    metric.TotalRamBytes = Convert.ToInt64(obj["TotalPhysicalMemory"]);
                }

                if (_winMemCounter != null)
                {
                    metric.FreeRamBytes = (long)_winMemCounter.NextValue();
                    metric.UsedRamBytes = metric.TotalRamBytes - metric.FreeRamBytes;
                }
            }
            catch {
                // Fallback to GC info if WMI fails
                var gcInfo = GC.GetGCMemoryInfo();
                metric.TotalRamBytes = gcInfo.TotalAvailableMemoryBytes;
            }
        }

        if (metric.TotalRamBytes > 0)
        {
            metric.UsagePercentage = Math.Round(((double)metric.UsedRamBytes / metric.TotalRamBytes) * 100, 2);
        }
        await Task.CompletedTask;
    }

    private async Task ParseNetworkWindowsAsync(List<NetworkMetrics> networks)
    {
        var interfaces = System.Net.NetworkInformation.NetworkInterface.GetAllNetworkInterfaces();
        foreach (var ni in interfaces)
        {
            if (ni.OperationalStatus == System.Net.NetworkInformation.OperationalStatus.Up && 
                ni.NetworkInterfaceType != System.Net.NetworkInformation.NetworkInterfaceType.Loopback)
            {
                var stats = ni.GetIPStatistics();
                networks.Add(new NetworkMetrics
                {
                    InterfaceName = ni.Name,
                    IncomingBytesPerSecond = stats.BytesReceived,
                    OutgoingBytesPerSecond = stats.BytesSent
                });
            }
        }
        await Task.CompletedTask;
    }

    private async Task ParseSystemInfoWindowsAsync(SystemInfoMetrics metric)
    {
        if (_cachedSystemInfo != null)
        {
             metric.Hostname = _cachedSystemInfo.Hostname;
             metric.OsVersion = _cachedSystemInfo.OsVersion;
             metric.KernelVersion = _cachedSystemInfo.KernelVersion;
        }
        else
        {
            metric.Hostname = Environment.MachineName;
            metric.OsVersion = RuntimeInformation.OSDescription;
            metric.KernelVersion = Environment.OSVersion.VersionString;
            _cachedSystemInfo = new SystemInfoMetrics { 
                Hostname = metric.Hostname, 
                OsVersion = metric.OsVersion, 
                KernelVersion = metric.KernelVersion 
            };
        }

        metric.Uptime = TimeSpan.FromMilliseconds(Environment.TickCount64);
        await Task.CompletedTask;
    }

    private async Task ParseProcessesWindowsAsync(List<ProcessMetrics> processes)
    {
        try
        {
            var sw = Stopwatch.StartNew();
            // Use WMI for high-performance formatted counters (this is pre-calculated by OS)
            using var searcher = new ManagementObjectSearcher(
                "SELECT IDProcess, Name, PercentProcessorTime, WorkingSetPrivate FROM Win32_PerfFormattedData_PerfProc_Process " +
                "WHERE Name != '_Total' AND Name != 'Idle'");
            
            searcher.Options.Timeout = TimeSpan.FromSeconds(2);
            int coreCount = Environment.ProcessorCount;
            var allProcesses = new List<ProcessMetrics>();

            using (var results = searcher.Get())
            {
                foreach (ManagementObject obj in results)
                {
                    try
                    {
                        var pidObj = obj["IDProcess"];
                        var nameObj = obj["Name"];
                        var cpuObj = obj["PercentProcessorTime"];
                        var memObj = obj["WorkingSetPrivate"];

                        if (pidObj == null) continue;

                        allProcesses.Add(new ProcessMetrics
                        {
                            ProcessId = Convert.ToInt32(pidObj),
                            Name = nameObj?.ToString() ?? "Unknown",
                            CpuUsagePercentage = Math.Round(Convert.ToDouble(cpuObj ?? 0) / coreCount, 1),
                            MemoryUsageBytes = Convert.ToInt64(memObj ?? 0)
                        });
                    }
                    catch (Exception ex)
                    {
                        Debug.WriteLine($"Error processing WMI object: {ex.Message}");
                    }
                }
            }

            if (!allProcesses.Any())
            {
                _logger.LogWarning("WMI query returned no processes. Falling back to Process.GetProcesses().");
                throw new Exception("Empty WMI result"); // Trigger fallback in catch block
            }

            _logger.LogDebug("WMI Process Collection took {Elapsed}ms for {Count} items.", sw.ElapsedMilliseconds, allProcesses.Count);

            var topCpu = allProcesses.OrderByDescending(p => p.CpuUsagePercentage).Take(15);
            var topMem = allProcesses.OrderByDescending(p => p.MemoryUsageBytes).Take(15);

            var merged = topCpu.Concat(topMem)
                .GroupBy(p => p.ProcessId)
                .Select(g => g.First())
                .OrderByDescending(p => p.CpuUsagePercentage)
                .ToList();

            processes.AddRange(merged);
        } 
        catch (Exception ex) 
        {
            Debug.WriteLine($"WMI Process Collection Error: {ex.Message}");
            // Fallback to basic process list if WMI fails
            try {
                var running = Process.GetProcesses()
                    .OrderByDescending(p => p.WorkingSet64)
                    .Take(15);
                    
                foreach (var p in running)
                {
                    processes.Add(new ProcessMetrics
                    {
                        ProcessId = p.Id,
                        Name = p.ProcessName,
                        MemoryUsageBytes = p.WorkingSet64,
                        CpuUsagePercentage = 0
                    });
                }
            } catch { }
        }
        await Task.CompletedTask;
    }

    private async Task ParseCpuLinuxAsync(CpuMetrics metric)
    {
        if (!File.Exists("/proc/stat")) return;

        string[] statLines = await File.ReadAllLinesAsync("/proc/stat");
        
        // Clear core usage to rebuild it
        metric.CoreUsagePercentages.Clear();

        foreach (var line in statLines)
        {
            if (line.StartsWith("cpu"))
            {
                string[] parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length < 5) continue;

                string cpuId = parts[0];
                ulong currentTotalTime = 0;
                // Sum all columns except the first one (cpuId)
                for (int i = 1; i < parts.Length; i++) 
                {
                    if (ulong.TryParse(parts[i], out ulong val)) currentTotalTime += val;
                }
                
                // Idle is the 4th numeric column (index 4 in the split parts)
                if (!ulong.TryParse(parts[4], out ulong currentIdleTime)) continue;

                if (_prevLinuxCpuTimes.TryGetValue(cpuId, out var prev))
                {
                    ulong totalDelta = currentTotalTime - prev.Total;
                    ulong idleDelta = currentIdleTime - prev.Idle;

                    if (totalDelta > 0)
                    {
                        double usage = Math.Round(100.0 * (1.0 - ((double)idleDelta / totalDelta)), 2);
                        usage = Math.Clamp(usage, 0, 100);

                        if (cpuId == "cpu")
                        {
                            metric.TotalUsagePercentage = usage;
                        }
                        else
                        {
                            metric.CoreUsagePercentages.Add(usage);
                        }
                    }
                }

                // Update persistence
                _prevLinuxCpuTimes[cpuId] = (currentTotalTime, currentIdleTime);
            }
            else if (!line.StartsWith("cpu") && metric.TotalUsagePercentage > 0)
            {
                // Optimization: stop if we passed the cpu section
                break;
            }
        }
        
        // Also get Load Average from /proc/loadavg
        if (File.Exists("/proc/loadavg"))
        {
            try {
                var loadAvgText = (await File.ReadAllTextAsync("/proc/loadavg")).Split(' ', StringSplitOptions.RemoveEmptyEntries);
                if (loadAvgText.Length >= 3) {
                    metric.LoadAverage[0] = double.Parse(loadAvgText[0]);
                    metric.LoadAverage[1] = double.Parse(loadAvgText[1]);
                    metric.LoadAverage[2] = double.Parse(loadAvgText[2]);
                }
            } catch { }
        }
    }

    private async Task ParseMemoryLinuxAsync(MemoryMetrics metric)
    {
        string[] memInfoLines = await File.ReadAllLinesAsync("/proc/meminfo");
        
        foreach (var line in memInfoLines)
        {
            if (line.StartsWith("MemTotal:")) metric.TotalRamBytes = ParseMemInfoValue(line);
            else if (line.StartsWith("MemAvailable:")) metric.FreeRamBytes = ParseMemInfoValue(line);
        }

        metric.UsedRamBytes = metric.TotalRamBytes - metric.FreeRamBytes;
        if (metric.TotalRamBytes > 0)
        {
            metric.UsagePercentage = Math.Round(((double)metric.UsedRamBytes / metric.TotalRamBytes) * 100, 2);
        }
    }

    private long ParseMemInfoValue(string line)
    {
        var parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length >= 2 && long.TryParse(parts[1], out long valueKb)) return valueKb * 1024;
        return 0;
    }
    
    private async Task ParseNetworkLinuxAsync(List<NetworkMetrics> networks)
    {
        string[] devLines = await File.ReadAllLinesAsync("/proc/net/dev");
        for (int i = 2; i < devLines.Length; i++)
        {
            var line = devLines[i].Trim();
            if (string.IsNullOrEmpty(line)) continue;
            
            var parts = line.Split(':', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length != 2) continue;
            
            var interfaceName = parts[0].Trim();
            if (interfaceName == "lo") continue;

            var values = parts[1].Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (values.Length >= 9)
            {
                networks.Add(new NetworkMetrics
                {
                    InterfaceName = interfaceName,
                    IncomingBytesPerSecond = long.Parse(values[0]),
                    OutgoingBytesPerSecond = long.Parse(values[8])
                });
            }
        }
    }
    
    private async Task ParseSystemInfoLinuxAsync(SystemInfoMetrics metric)
    {
        if (_cachedSystemInfo != null)
        {
            metric.Hostname = _cachedSystemInfo.Hostname;
            metric.OsVersion = _cachedSystemInfo.OsVersion;
            metric.KernelVersion = _cachedSystemInfo.KernelVersion;
        }
        else
        {
            if (File.Exists("/proc/sys/kernel/hostname")) metric.Hostname = (await File.ReadAllTextAsync("/proc/sys/kernel/hostname")).Trim();
            if (File.Exists("/proc/version")) metric.KernelVersion = (await File.ReadAllTextAsync("/proc/version")).Split(' ')[2];
            if (File.Exists("/etc/os-release"))
            {
                var lines = await File.ReadAllLinesAsync("/etc/os-release");
                var prettyNameLine = lines.FirstOrDefault(l => l.StartsWith("PRETTY_NAME="));
                if (prettyNameLine != null) metric.OsVersion = prettyNameLine.Split('=')[1].Trim('"');
            }
            _cachedSystemInfo = new SystemInfoMetrics { 
                Hostname = metric.Hostname, 
                OsVersion = metric.OsVersion, 
                KernelVersion = metric.KernelVersion 
            };
        }

        if (File.Exists("/proc/uptime"))
        {
            var uptimeText = await File.ReadAllTextAsync("/proc/uptime");
            metric.Uptime = TimeSpan.FromSeconds(double.Parse(uptimeText.Split(' ', StringSplitOptions.RemoveEmptyEntries)[0]));
        }
    }

    private async Task ParseDiskAsync(List<DiskMetrics> disks)
    {
        try
        {
            var drives = DriveInfo.GetDrives();
            foreach (var drive in drives)
            {
                if (drive.IsReady && drive.DriveType == DriveType.Fixed)
                {
                    if (drive.Name.StartsWith("/snap") || drive.Name.StartsWith("/sys") || drive.Name.StartsWith("/run") || drive.Name.StartsWith("/dev"))
                        continue;

                    var total = drive.TotalSize;
                    var free = drive.TotalFreeSpace;
                    var used = total - free;
                    double percentage = total > 0 ? Math.Round(((double)used / total) * 100, 2) : 0;

                    disks.Add(new DiskMetrics
                    {
                        MountPoint = drive.Name,
                        TotalSpaceBytes = total,
                        FreeSpaceBytes = free,
                        UsedSpaceBytes = used,
                        UsagePercentage = percentage
                    });
                }
            }
        } catch { }
        await Task.CompletedTask;
    }

    private async Task ParseProcessesLinuxAsync(List<ProcessMetrics> processes)
    {
        processes.AddRange(_lastProcessList);

        if (DateTime.UtcNow - _lastProcessListTime > _processCacheTtl && !_isProcessUpdating)
        {
            _isProcessUpdating = true;
            _ = Task.Run(async () =>
            {
                try
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = "ps",
                        Arguments = "-eo pid,comm,%cpu,rss --sort=-%cpu",
                        RedirectStandardOutput = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    };

                    using var process = Process.Start(psi);
                    if (process == null) return;

                    string output = await process.StandardOutput.ReadToEndAsync();
                    await process.WaitForExitAsync();

                    var lines = output.Split('\n', StringSplitOptions.RemoveEmptyEntries);
                    int coreCount = Environment.ProcessorCount;
                    
                    var allProcs = new List<ProcessMetrics>();
                    for (int i = 1; i < lines.Length; i++)
                    {
                        var parts = lines[i].Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
                        if (parts.Length >= 4)
                        {
                            if (int.TryParse(parts[0], out int pid) && 
                                double.TryParse(parts[parts.Length - 2], out double cpu) && 
                                long.TryParse(parts[parts.Length - 1], out long rss))
                            {
                                string name = string.Join(" ", parts.Skip(1).Take(parts.Length - 3));
                                allProcs.Add(new ProcessMetrics
                                {
                                    ProcessId = pid,
                                    Name = name,
                                    CpuUsagePercentage = Math.Round(cpu / coreCount, 2),
                                    MemoryUsageBytes = rss * 1024
                                });
                            }
                        }
                    }

                    var merged = allProcs.OrderByDescending(p => p.CpuUsagePercentage).Take(15)
                        .Concat(allProcs.OrderByDescending(p => p.MemoryUsageBytes).Take(15))
                        .GroupBy(p => p.ProcessId)
                        .Select(g => g.First())
                        .ToList();

                    _lastProcessList = merged;
                    _lastProcessListTime = DateTime.UtcNow;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to parse Linux processes via 'ps' command.");
                }
                finally
                {
                    _isProcessUpdating = false;
                }
            });
        }
        await Task.CompletedTask;
    }

    private async Task ParseDockerAsync(ServerMetricsSnapshot snapshot)
    {
        if (_dockerClient == null) return;

        snapshot.DockerContainers.AddRange(_lastDockerContainers);
        snapshot.DockerStats.TotalContainers = _cachedDockerStats.TotalContainers;
        snapshot.DockerStats.RunningContainers = _cachedDockerStats.RunningContainers;
        snapshot.DockerStats.StoppedContainers = _cachedDockerStats.StoppedContainers;
        snapshot.DockerStats.TotalImages = _cachedDockerStats.TotalImages;

        if (DateTime.UtcNow - _lastDockerListTime > _dockerCacheTtl && !_isDockerUpdating)
        {
            _isDockerUpdating = true;
            _ = Task.Run(async () =>
            {
                try
                {
                    var containers = await _dockerClient.Containers.ListContainersAsync(new ContainersListParameters { All = true });
                    
                    var dockerContainers = new List<DockerContainerMetrics>();
                    using var semaphore = new SemaphoreSlim(5);

                    var containerStatsTasks = containers.Select(async c => {
                        var container = new DockerContainerMetrics
                        {
                            ContainerId = c.ID.Length >= 12 ? c.ID.Substring(0, 12) : c.ID,
                            Name = c.Names.FirstOrDefault()?.TrimStart('/') ?? "unknown",
                            Image = c.Image,
                            Status = c.Status,
                            State = c.State
                        };

                        if (c.State == "running")
                        {
                            await semaphore.WaitAsync();
                            try {
                                using var statsStream = await _dockerClient!.Containers.GetContainerStatsAsync(c.ID, new ContainerStatsParameters { Stream = false }, CancellationToken.None);
                                using var reader = new System.IO.StreamReader(statsStream);
                                var json = await reader.ReadToEndAsync();
                                if (!string.IsNullOrEmpty(json)) {
                                    var stats = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.Nodes.JsonNode>(json);
                                    if (stats != null) {
                                        var memUsage = stats["memory_stats"]?["usage"]?.GetValue<long>() ?? 0;
                                        container.MemoryUsageBytes = memUsage;
                                        
                                        var cpuStats = stats["cpu_stats"];
                                        var precpuStats = stats["precpu_stats"];
                                        if (cpuStats != null && precpuStats != null) {
                                            var cpuTotal = (double)(cpuStats["cpu_usage"]?["total_usage"]?.GetValue<long>() ?? 0);
                                            var precpuTotal = (double)(precpuStats["cpu_usage"]?["total_usage"]?.GetValue<long>() ?? 0);
                                            var systemCpu = (double)(cpuStats["system_cpu_usage"]?.GetValue<long>() ?? 0);
                                            var presystemCpu = (double)(precpuStats["system_cpu_usage"]?.GetValue<long>() ?? 0);
                                            var cpuDelta = cpuTotal - precpuTotal;
                                            var systemDelta = systemCpu - presystemCpu;
                                            if (systemDelta > 0 && cpuDelta > 0) {
                                                container.CpuPercentage = Math.Round((cpuDelta / systemDelta) * (double)(cpuStats["online_cpus"]?.GetValue<int>() ?? 1) * 100.0, 2);
                                            }
                                        }
                                    }
                                }
                            } catch { }
                            finally {
                                semaphore.Release();
                            }
                        }
                        return container;
                    });

                    _lastDockerContainers = (await Task.WhenAll(containerStatsTasks)).ToList();
                    
                    _cachedDockerStats.TotalContainers = _lastDockerContainers.Count;
                    _cachedDockerStats.RunningContainers = _lastDockerContainers.Count(c => c.State == "running");
                    _cachedDockerStats.StoppedContainers = _lastDockerContainers.Count(c => c.State == "exited" || c.State == "created");
                    
                    var images = await _dockerClient.Images.ListImagesAsync(new ImagesListParameters());
                    _cachedDockerStats.TotalImages = images.Count;

                    _lastDockerListTime = DateTime.UtcNow;
                }
                catch (Exception ex)
                {
                    _logger.LogDebug("Docker collection skipped: {Message}", ex.Message);
                }
                finally
                {
                    _isDockerUpdating = false;
                }
            });
        }
        await Task.CompletedTask;
    }

    private string FormatBytes(long bytes)
    {
        string[] Suffix = { "B", "KB", "MB", "GB", "TB" };
        int i;
        double dblSByte = bytes;
        for (i = 0; i < Suffix.Length && bytes >= 1024; i++, bytes /= 1024)
        {
            dblSByte = bytes / 1024.0;
        }
        return string.Format("{0:0.##}{1}", dblSByte, Suffix[i]);
    }
}
#pragma warning restore CA1416
