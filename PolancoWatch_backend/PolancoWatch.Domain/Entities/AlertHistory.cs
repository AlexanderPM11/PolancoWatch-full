using System;
using PolancoWatch.Domain.Common;

namespace PolancoWatch.Domain.Entities;

public class AlertHistory
{
    public int Id { get; set; }
    public int AlertRuleId { get; set; }
    public AlertRule AlertRule { get; set; } = null!;
    public string Message { get; set; } = string.Empty;
    public DateTimeOffset TriggeredAt { get; set; } = TimeHelper.Now;
}
