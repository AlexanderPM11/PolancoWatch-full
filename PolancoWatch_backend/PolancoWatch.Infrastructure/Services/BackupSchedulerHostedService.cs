using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using PolancoWatch.Domain.Entities;
using PolancoWatch.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using PolancoWatch.Infrastructure.Helpers;
using PolancoWatch.Domain.Common;

namespace PolancoWatch.Infrastructure.Services;

public class BackupSchedulerHostedService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<BackupSchedulerHostedService> _logger;

    public BackupSchedulerHostedService(
        IServiceProvider serviceProvider,
        ILogger<BackupSchedulerHostedService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Backup Scheduler Service is starting.");

        while (!stoppingToken.IsCancellationRequested)
        {
            await CheckAndRunSchedulesAsync();
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }

        _logger.LogInformation("Backup Scheduler Service is stopping.");
    }

    private async Task CheckAndRunSchedulesAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var backupManager = scope.ServiceProvider.GetRequiredService<BackupManager>();

        var now = TimeHelper.Now;
        var pendingSchedules = await context.BackupSchedules
            .Where(s => s.IsActive && (s.NextRun == null || s.NextRun <= now))
            .ToListAsync();

        foreach (var schedule in pendingSchedules)
        {
            var drTz = ScheduleHelper.GetDominicanTimeZone();
            var drTime = TimeZoneInfo.ConvertTimeFromUtc(now.UtcDateTime, drTz);
            var timestamp = new DateTimeOffset(drTime, drTz.BaseUtcOffset).ToString("yyyy-MM-ddTHH:mm:sszzz");

            try
            {
                _logger.LogInformation("[{Timestamp}] Starting scheduled backup: {ScheduleName}", timestamp, schedule.Name);
                
                await backupManager.RunBackupAsync(
                    schedule.Type, 
                    schedule.Target, 
                    schedule.Format, 
                    schedule.SyncToCloud,
                    schedule.CloudFolderId,
                    schedule.Name,
                    schedule.KeepLocal,
                    schedule.RetentionCount);

                schedule.LastRun = now;
                schedule.NextRun = ScheduleHelper.CalculateNextRun(schedule, now);
                await context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Scheduled backup failed for {ScheduleName}", schedule.Name);
                schedule.NextRun = ScheduleHelper.CalculateNextRun(schedule, now);
                await context.SaveChangesAsync();
            }
        }
    }
}
