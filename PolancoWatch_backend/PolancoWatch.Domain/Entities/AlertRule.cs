using System;

namespace PolancoWatch.Domain.Entities;

public class AlertRule
{
    public int Id { get; set; }
    public MetricType MetricType { get; set; }
    public double Threshold { get; set; }
    public bool IsActive { get; set; }
    public int CooldownSeconds { get; set; } = 300;
}
