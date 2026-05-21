using Microsoft.Extensions.Logging;
using PolancoWatch.Application.Interfaces;
using PolancoWatch.Domain.Entities;

namespace PolancoWatch.Infrastructure.Services;

public class ConsoleAlertNotifier : IAlertNotifier
{
    private readonly ILogger<ConsoleAlertNotifier> _logger;

    public ConsoleAlertNotifier(ILogger<ConsoleAlertNotifier> logger)
    {
        _logger = logger;
    }

    public Task NotifyAsync(AlertRule rule, string message, double currentValue, NotificationSettings settings)
    {
        // In a real scenario, this could be extended to send Emails, Slack messages, etc.
        // For now, it logs a critical warning to the server console which can be picked up by Docker logs.
        _logger.LogWarning("============== POLANCOWATCH ALERT ==============");
        _logger.LogWarning("Rule Triggered: {RuleId} - {MetricType}", rule.Id, rule.MetricType);
        _logger.LogWarning("Message: {Message}", message);
        _logger.LogWarning("Current Value: {CurrentValue}% | Threshold: {Threshold}%", currentValue, rule.Threshold);
        _logger.LogWarning("==================================================");
        
        return Task.CompletedTask;
    }
}
