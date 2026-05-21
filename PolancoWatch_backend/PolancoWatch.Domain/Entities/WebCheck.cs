using System;
using PolancoWatch.Domain.Common;

namespace PolancoWatch.Domain.Entities;

public class WebCheck
{
    public int Id { get; set; }
    public int WebMonitorId { get; set; }
    public DateTimeOffset Timestamp { get; set; } = TimeHelper.Now;
    public bool IsUp { get; set; }
    public double LatencyMs { get; set; }
    public bool IsSlow { get; set; }
    public int StatusCode { get; set; }
    public string? ErrorMessage { get; set; }
}
