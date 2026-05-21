using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using PolancoWatch.Application.Interfaces;
using PolancoWatch.Domain.Entities;
using PolancoWatch.Domain.Models;
using PolancoWatch.Infrastructure.Data;
using PolancoWatch.Domain.Common;

namespace PolancoWatch.Infrastructure.Services;

public class AlertEvaluatorHostedService : BackgroundService
{
    private readonly ILogger<AlertEvaluatorHostedService> _logger;
    private readonly IEnumerable<IAlertNotifier> _alertNotifiers;
    private readonly IServiceProvider _serviceProvider;
    private readonly TimeSpan _evaluationInterval = TimeSpan.FromSeconds(5);
    
    // We store the last snapshot here directly or we could subscribe to a queue
    private ServerMetricsSnapshot? _latestSnapshot;
    private readonly Dictionary<int, DateTime> _lastTriggeredTimes = new();


    public AlertEvaluatorHostedService(
        ILogger<AlertEvaluatorHostedService> logger,
        IEnumerable<IAlertNotifier> alertNotifiers,
        IServiceProvider serviceProvider)
    {
        _logger = logger;
        _alertNotifiers = alertNotifiers;
        _serviceProvider = serviceProvider;
    }

    public void UpdateSnapshot(ServerMetricsSnapshot snapshot)
    {
        _latestSnapshot = snapshot;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Alert Evaluator Hosted Service is starting.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (_latestSnapshot != null)
                {
                    await EvaluateAlertsAsync(_latestSnapshot, stoppingToken);
                }

                await Task.Delay(_evaluationInterval, stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while evaluating alerts.");
                await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            }
        }

        _logger.LogInformation("Alert Evaluator Hosted Service is stopping.");
    }

    private async Task EvaluateAlertsAsync(ServerMetricsSnapshot snapshot, CancellationToken token)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        List<AlertRule> activeRules;
        NotificationSettings settings;

        try
        {
            activeRules = dbContext.AlertRules.Where(r => r.IsActive).ToList();
            settings = dbContext.NotificationSettings.FirstOrDefault() ?? new NotificationSettings();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve alert rules or notification settings. The database schema might be out of date.");
            return;
        }

        foreach (var rule in activeRules)
        {
            bool isTriggered = false;
            double currentValue = 0;

            try
            {
                switch (rule.MetricType)
                {
                    case MetricType.Cpu:
                        currentValue = snapshot.Cpu?.TotalUsagePercentage ?? 0;
                        isTriggered = currentValue >= rule.Threshold;
                        break;
                    case MetricType.Memory:
                        currentValue = snapshot.Memory?.UsagePercentage ?? 0;
                        isTriggered = currentValue >= rule.Threshold;
                        break;
                    case MetricType.Disk:
                        currentValue = snapshot.Disks?.Select(d => d.UsagePercentage).DefaultIfEmpty(0).Max() ?? 0;
                        isTriggered = currentValue >= rule.Threshold;
                        break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error evaluating rule {RuleId}", rule.Id);
                continue;
            }

            if (isTriggered)
            {
                 // Debouncing
                 if (_lastTriggeredTimes.TryGetValue(rule.Id, out var lastTriggered))
                 {
                     if (DateTime.UtcNow - lastTriggered < TimeSpan.FromSeconds(rule.CooldownSeconds))
                     {
                         continue; // Skip within cooldown
                     }
                 }

                 string message = $"ALERT: {rule.MetricType} usage is at {currentValue}% (Threshold: {rule.Threshold}%)";
                 
                 _logger.LogWarning(message);
                 _lastTriggeredTimes[rule.Id] = DateTime.UtcNow;
                 
                 // Save History

                 var history = new AlertHistory
                 {
                     AlertRuleId = rule.Id,
                     TriggeredAt = TimeHelper.Now,
                     Message = message
                 };
                 dbContext.AlertHistories.Add(history);
                                  // Broadcast using all Notifiers
                  foreach(var notifier in _alertNotifiers)
                  {
                      await notifier.NotifyAsync(rule, message, currentValue, settings);
                  }
            }
        }
        
        await dbContext.SaveChangesAsync(token);
    }
}
