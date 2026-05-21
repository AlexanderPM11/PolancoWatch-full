using System;

namespace PolancoWatch.Domain.Entities;

public class WebMonitorDailyStats
{
    public int Id { get; set; }
    public int WebMonitorId { get; set; }
    public WebMonitor? WebMonitor { get; set; }
    public DateTime Date { get; set; } // Store only date portion

    public double UpPercentage { get; set; }
    public double DownPercentage { get; set; }
    public double SlowPercentage { get; set; }
    
    public double AverageLatencyMs { get; set; }
    public int TotalChecks { get; set; }
    
    public int UpCount { get; set; }
    public int DownCount { get; set; }
    public int SlowCount { get; set; }
}
