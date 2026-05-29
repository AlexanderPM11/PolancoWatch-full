using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using PolancoWatch.Application.Interfaces;
using PolancoWatch.Domain.Entities;
using PolancoWatch.Infrastructure.Data;
using Microsoft.AspNetCore.SignalR;
using PolancoWatch.Infrastructure.Hubs;
using Hangfire;

namespace PolancoWatch.Infrastructure.Services;

public class RestoreManager
{
    private readonly IServiceProvider _serviceProvider;
    private readonly RestoreStrategyFactory _restoreStrategyFactory;
    private readonly IHubContext<BackupHub> _hubContext;
    private readonly ILogger<RestoreManager> _logger;

    public RestoreManager(
        IServiceProvider serviceProvider,
        RestoreStrategyFactory restoreStrategyFactory,
        IHubContext<BackupHub> hubContext,
        ILogger<RestoreManager> logger)
    {
        _serviceProvider = serviceProvider;
        _restoreStrategyFactory = restoreStrategyFactory;
        _hubContext = hubContext;
        _logger = logger;
    }

    [AutomaticRetry(Attempts = 0)]
    public async Task<Restore> RunRestoreAsync(Guid restoreId)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        
        var restore = await context.Restores.FindAsync(restoreId);
        if (restore == null)
        {
            _logger.LogError("Restore {RestoreId} not found.", restoreId);
            throw new Exception($"Restore {restoreId} not found.");
        }

        restore.Status = RestoreStatus.InProgress;
        await context.SaveChangesAsync();
        await BroadcastProgress(restore.Id, 5, "Starting restore process...");

        try
        {
            var restoreContext = new RestoreContext
            {
                Type = restore.Type,
                TargetContainer = restore.TargetContainer,
                FilePath = restore.FilePath ?? string.Empty,
                RestoreName = restore.Name
            };

            var strategy = _restoreStrategyFactory.GetStrategy(restore.Type);
            await BroadcastProgress(restore.Id, 10, "Executing restore strategy...");
            
            await strategy.ExecuteRestoreAsync(restoreContext);

            restore.Status = RestoreStatus.Completed;
            restore.CompletedAt = DateTimeOffset.UtcNow;
            
            // Delete temporary uploaded file after successful restore
            if (!string.IsNullOrEmpty(restore.FilePath) && File.Exists(restore.FilePath))
            {
                try
                {
                    File.Delete(restore.FilePath);
                    _logger.LogInformation("Deleted uploaded restore file: {Path}", restore.FilePath);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to delete uploaded restore file.");
                }
            }

            await context.SaveChangesAsync();
            await BroadcastProgress(restore.Id, 100, "Restore completed successfully.");

            return restore;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Restore {RestoreId} failed.", restore.Id);
            
            restore.Status = RestoreStatus.Failed;
            restore.ErrorMessage = ex.Message;
            restore.CompletedAt = DateTimeOffset.UtcNow;
            await context.SaveChangesAsync();
            
            await BroadcastProgress(restore.Id, 100, $"Restore failed: {ex.Message}");
            throw;
        }
    }

    private async Task BroadcastProgress(Guid restoreId, int percentage, string message)
    {
        await _hubContext.Clients.All.SendAsync("ReceiveRestoreProgress", restoreId, percentage, message);
    }
}
