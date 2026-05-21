using System;
using System.Management;
using System.Linq;
using System.Diagnostics;

try {
    using var searcher = new ManagementObjectSearcher(
        "SELECT IDProcess, Name, PercentProcessorTime, WorkingSetPrivate FROM Win32_PerfFormattedData_PerfProc_Process " +
        "WHERE Name != '_Total' AND Name != 'Idle'");
        
    int coreCount = Environment.ProcessorCount;
    var results = searcher.Get()
        .Cast<ManagementObject>()
        .Select(obj => {
            try {
                return new {
                    Pid = Convert.ToInt32(obj["IDProcess"]),
                    Name = obj["Name"]?.ToString() ?? "Unknown",
                    Cpu = Convert.ToDouble(obj["PercentProcessorTime"]),
                    Mem = Convert.ToInt64(obj["WorkingSetPrivate"])
                };
            } catch (Exception ex) {
                Console.WriteLine($"Error processing object: {ex.Message}");
                return null;
            }
        })
        .Where(x => x != null && x.Pid > 0)
        .ToList();

    Console.WriteLine($"Successfully collected {results.Count} processes.");
    foreach (var p in results.OrderByDescending(r => r.Cpu).Take(5)) {
        Console.WriteLine($"PID: {p.Pid}, Name: {p.Name}, CPU: {p.Cpu/coreCount}%, RAM: {p.Mem/1024/1024}MB");
    }
} catch (Exception ex) {
    Console.WriteLine($"COLLECTION FATAL ERROR: {ex.Message}");
    Console.WriteLine(ex.StackTrace);

    
}
