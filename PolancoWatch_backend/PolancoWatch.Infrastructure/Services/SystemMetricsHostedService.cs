using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using PolancoWatch.Application.Interfaces;
using PolancoWatch.Domain.Models;

namespace PolancoWatch.Infrastructure.Services;

public class SystemMetricsHostedService : BackgroundService
{
    private readonly ILogger<SystemMetricsHostedService> _logger;
    private readonly IMetricsCollector _metricsCollector;
    private readonly IMetricsBroadcaster _metricsBroadcaster;
    private readonly TimeSpan _collectionInterval = TimeSpan.FromSeconds(2);
    private readonly AlertEvaluatorHostedService _alertEvaluator;

    public SystemMetricsHostedService(
        ILogger<SystemMetricsHostedService> logger, 
        IMetricsCollector metricsCollector,
        IMetricsBroadcaster metricsBroadcaster,
        AlertEvaluatorHostedService alertEvaluator)
    {
        _logger = logger;
        _metricsCollector = metricsCollector;
        _metricsBroadcaster = metricsBroadcaster;
        _alertEvaluator = alertEvaluator;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("System Metrics Hosted Service is starting.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var snapshot = await _metricsCollector.CollectMetricsAsync();
                
                await _metricsBroadcaster.BroadcastMetricsAsync(snapshot);
                _alertEvaluator.UpdateSnapshot(snapshot);
                
                _logger.LogInformation("Broadcasted metrics on SignalR for CPU: {CpuUsage}%", snapshot.Cpu.TotalUsagePercentage);

                await Task.Delay(_collectionInterval, stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while collecting system metrics.");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken); // Backoff on error
            }
        }

        _logger.LogInformation("System Metrics Hosted Service is stopping.");
    }
}
