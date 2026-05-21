using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using PolancoWatch.Application.Interfaces;
using PolancoWatch.Domain.Entities;
using PolancoWatch.Domain.Common;
using PolancoWatch.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace PolancoWatch.Infrastructure.Services;

public class MetricPersistenceHostedService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<MetricPersistenceHostedService> _logger;
    private readonly TimeSpan _period = TimeSpan.FromMinutes(1);

    public MetricPersistenceHostedService(IServiceProvider serviceProvider, ILogger<MetricPersistenceHostedService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Metric Persistence Service is starting.");

        using PeriodicTimer timer = new PeriodicTimer(_period);
        
        // Initial save on startup
        try
        {
            await SaveMetricSnapshot(stoppingToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Initial metric save failed.");
        }

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await SaveMetricSnapshot(stoppingToken);
                await PruneOldMetrics(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in Metric Persistence Service.");
            }
        }
    }

    private async Task SaveMetricSnapshot(CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var metricsCollector = scope.ServiceProvider.GetRequiredService<IMetricsCollector>();

        var metrics = await metricsCollector.CollectMetricsAsync();

        var historicalMetric = new HistoricalMetric
        {
            Timestamp = TimeHelper.Now,
            CpuUsage = metrics.Cpu.TotalUsagePercentage,
            MemoryUsage = metrics.Memory.UsagePercentage,
            DiskUsage = metrics.Disks.FirstOrDefault()?.UsagePercentage ?? 0
        };

        context.HistoricalMetrics.Add(historicalMetric);
        await context.SaveChangesAsync(ct);
        
        _logger.LogInformation("Saved historical metric snapshot at {Time}", historicalMetric.Timestamp);
    }

    private async Task PruneOldMetrics(CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // Keep last 7 days of data
        var cutoff = TimeHelper.Now.AddDays(-7);
        var oldMetrics = await context.HistoricalMetrics
            .Where(m => m.Timestamp < cutoff)
            .ExecuteDeleteAsync(ct);

        if (oldMetrics > 0)
        {
            _logger.LogInformation("Pruned {Count} old metric(s) older than {Cutoff}", oldMetrics, cutoff);
        }
    }
}
