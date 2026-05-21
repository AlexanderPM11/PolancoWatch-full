using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using PolancoWatch.Application.Interfaces;
using PolancoWatch.Domain.Entities;
using PolancoWatch.Infrastructure.Data;
using Microsoft.AspNetCore.SignalR;
using PolancoWatch.Infrastructure.Hubs;
using Microsoft.EntityFrameworkCore;
using PolancoWatch.Infrastructure.Helpers;
using PolancoWatch.Domain.Common;

namespace PolancoWatch.Infrastructure.Services;

public class BackupManager
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IBackupService _backupService;
    private readonly IGoogleDriveService _googleDriveService;
    private readonly IHubContext<BackupHub> _hubContext;
    private readonly ILogger<BackupManager> _logger;

    public BackupManager(
        IServiceProvider serviceProvider,
        IBackupService backupService,
        IGoogleDriveService googleDriveService,
        IHubContext<BackupHub> hubContext,
        ILogger<BackupManager> logger)
    {
        _serviceProvider = serviceProvider;
        _backupService = backupService;
        _googleDriveService = googleDriveService;
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task<Backup> RunBackupAsync(BackupType type, string? target, BackupFormat format, bool syncToCloud = false, string? cloudFolderId = null, string? backupName = null, bool keepLocal = true, int retentionCount = 0, bool sendTelegram = false)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var telegramService = scope.ServiceProvider.GetRequiredService<ITelegramService>();
        var settings = await context.NotificationSettings.FirstOrDefaultAsync();
        var drNow = TimeHelper.Now;
        var timestamp = drNow.ToString("yyyy-MM-ddTHH:mm:sszzz");

        _logger.LogInformation("[{Timestamp}] RunBackupAsync triggered: Type={Type}, SyncToCloud={SyncToCloud}, KeepLocal={KeepLocal}", timestamp, type, syncToCloud, keepLocal);

        // Previous drNow was already calculated above for the timestamp
        var backup = new Backup
        {
            Name = backupName ?? $"{type}_{drNow:yyyyMMddHHmmss}",
            Type = type,
            Format = format,
            CreatedAt = drNow,
            Status = BackupStatus.InProgress
        };

        context.Backups.Add(backup);
        await context.SaveChangesAsync();

        await BroadcastProgress(backup.Id, 10, "Starting backup...");

        try
        {
            string filePath;
            if (type == BackupType.Database)
            {
                if (string.IsNullOrEmpty(target))
                {
                    filePath = await _backupService.CreateDatabaseBackupAsync(format, backup.Name);
                }
                else
                {
                    string containerRef = target;
                    string? dbName = null;
                    string dbUser = "root";
                    string? dbPass = null;

                    if (target.Contains("::"))
                    {
                        var parts = target.Split("::");
                        containerRef = parts[0];
                        if (parts.Length > 1 && !string.IsNullOrEmpty(parts[1])) dbName = parts[1];
                        if (parts.Length > 2 && !string.IsNullOrEmpty(parts[2])) dbUser = parts[2];
                        if (parts.Length > 3 && !string.IsNullOrEmpty(parts[3])) dbPass = parts[3];
                    }
                    filePath = await _backupService.CreateDockerDatabaseBackupAsync(containerRef, dbName, format, backup.Name, dbUser, dbPass);
                }
            }
            else
            {
                if (string.IsNullOrEmpty(target)) throw new ArgumentException("Target path is required for volume backups.");
                filePath = await _backupService.CreateVolumeBackupAsync(target, format, backup.Name);
            }

            // Integrity check: ensure the backup file exists and is not 0 bytes
            var fileInfo = new FileInfo(filePath);
            if (!fileInfo.Exists || fileInfo.Length == 0)
            {
                throw new InvalidOperationException($"Backup integrity check failed: file '{filePath}' is missing or is 0 bytes. The backup process may have been corrupted.");
            }

            backup.FilePath = filePath;
            backup.Size = fileInfo.Length;
            backup.Status = BackupStatus.Completed;

            await BroadcastProgress(backup.Id, 50, "Backup file created locally.");

            if (syncToCloud)
            {
                await BroadcastProgress(backup.Id, 60, "Uploading to Google Drive...");
                try
                {
                    string? targetFolderId = cloudFolderId;
                    if (!string.IsNullOrEmpty(cloudFolderId))
                    {
                        targetFolderId = await _googleDriveService.GetOrCreateFolderAsync(backup.Name, cloudFolderId);
                    }

                    var (fileId, link) = await _googleDriveService.UploadFileAsync(filePath, Path.GetFileName(filePath), targetFolderId);
                    backup.CloudFileId = fileId;
                    backup.CloudLink = link;
                    backup.CloudSyncStatus = CloudSyncStatus.Synced;
                    await BroadcastProgress(backup.Id, 90, "Cloud sync completed.");

                    // Retention Cleanup
                    if (retentionCount > 0 && !string.IsNullOrEmpty(cloudFolderId))
                    {
                        try
                        {
                            // We use the same targetFolderId we resolved above
                            var subfolderIdForRetention = await _googleDriveService.GetOrCreateFolderAsync(backup.Name, cloudFolderId);
                            var files = await _googleDriveService.ListFilesAsync(subfolderIdForRetention);
                            if (files.Count > retentionCount)
                            {
                                var filesToDelete = files.Skip(retentionCount).ToList();
                                foreach (var f in filesToDelete)
                                {
                                    await _googleDriveService.DeleteFileAsync(f.id);
                                    _logger.LogInformation("Deleted old cloud backup for retention: {FileName} ({FileId})", f.name, f.id);
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Failed to perform cloud retention cleanup.");
                        }
                    }

                    // If Drive-only mode: delete local file after successful upload
                    if (!keepLocal && File.Exists(filePath))
                    {
                        File.Delete(filePath);
                        backup.FilePath = null; // No longer stored locally
                        _logger.LogInformation("Local file deleted after cloud upload (Drive-only mode): {Path}", filePath);
                        await BroadcastProgress(backup.Id, 95, "Local copy removed (Drive-only mode).");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to sync backup {BackupId} to cloud.", backup.Id);
                    backup.CloudSyncStatus = CloudSyncStatus.Failed;
                    backup.ErrorMessage = ex.Message;
                    await BroadcastProgress(backup.Id, 90, $"Cloud sync failed: {ex.Message}");
                }
            }

            await context.SaveChangesAsync();
            await BroadcastProgress(backup.Id, 100, "Backup process finished successfully.");

            if (sendTelegram && settings != null && settings.TelegramEnabled)
            {
                var successMsg = $"✅ *Backup Exitoso*\n\n" +
                               $"*Recurso:* {backup.Name}\n" +
                               $"*Tipo:* {(type == BackupType.Database ? "Base de Datos" : "Volumen")}\n" +
                               $"*Tamaño:* {FormatSize(backup.Size)}\n" +
                               $"*Nube:* {(syncToCloud ? backup.CloudSyncStatus.ToString() : "N/A")}\n" +
                               $"*Destino Cloud:* {(string.IsNullOrEmpty(backup.CloudLink) ? "Ninguno" : $"[Ver]({backup.CloudLink})")}\n" +
                               $"\n_Respaldado en PolancoVault_";
                try { await telegramService.SendMessageAsync(successMsg, settings); } catch { }
            }

            return backup;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Backup {BackupId} failed.", backup.Id);
            
            // Capture if it was partial before changing status
            bool isPartial = backup.Status == BackupStatus.InProgress || backup.Status == BackupStatus.Pending;
            
            backup.Status = BackupStatus.Failed;
            backup.ErrorMessage = ex.Message;
            await context.SaveChangesAsync();
            await BroadcastProgress(backup.Id, 100, $"Backup failed: {ex.Message}");
            
            // Cleanup partial or temporary local files
            if (!string.IsNullOrEmpty(backup.FilePath) && File.Exists(backup.FilePath))
            {
                try
                {
                    // Always delete if it was a partial/incomplete file
                    // Or if it was a cloud-only backup that failed sync (to stay consistent with policy)
                    if (isPartial || !keepLocal)
                    {
                        File.Delete(backup.FilePath);
                        _logger.LogInformation("Deleted residue/partial file after backup failure: {Path}", backup.FilePath);
                        if (isPartial) backup.FilePath = null;
                        await context.SaveChangesAsync();
                    }
                }
                catch (Exception cleanupEx)
                {
                    _logger.LogWarning(cleanupEx, "Failed to clean up partial file {FilePath}", backup.FilePath);
                }
            }

            // If a partial or corrupted file was already uploaded to Google Drive, delete it from the cloud
            if (!string.IsNullOrEmpty(backup.CloudFileId))
            {
                try
                {
                    _logger.LogWarning("Attempting to delete residual cloud file after backup failure. CloudFileId: {CloudFileId}", backup.CloudFileId);
                    await _googleDriveService.DeleteFileAsync(backup.CloudFileId);
                    _logger.LogInformation("Successfully deleted residual cloud file: {CloudFileId}", backup.CloudFileId);
                    backup.CloudFileId = null;
                    backup.CloudLink = null;
                    backup.CloudSyncStatus = CloudSyncStatus.Failed;
                    await context.SaveChangesAsync();
                }
                catch (Exception cloudCleanupEx)
                {
                    _logger.LogWarning(cloudCleanupEx, "Failed to delete residual cloud file {CloudFileId} after backup failure. Manual cleanup may be required.", backup.CloudFileId);
                }
            }
            
            if (sendTelegram && settings != null && settings.TelegramEnabled)
            {
                var failMsg = $"❌ *Error Crítico de Respaldo*\n\n" +
                              $"*Recurso:* {backupName ?? "Desconocido"}\n" +
                              $"*Error:* {ex.Message}\n\n" +
                              $"_Intervención requerida en PolancoVault_";
                try { await telegramService.SendMessageAsync(failMsg, settings); } catch { }
            }

            throw;
        }
    }

    private async Task BroadcastProgress(Guid backupId, int percentage, string message)
    {
        await _hubContext.Clients.All.SendAsync("ReceiveBackupProgress", backupId, percentage, message);
    }

    private string FormatSize(long bytes)
    {
        if (bytes == 0) return "0 B";
        string[] sizes = { "B", "KB", "MB", "GB", "TB" };
        int order = 0;
        double len = bytes;
        while (len >= 1024 && order < sizes.Length - 1)
        {
            order++;
            len = len / 1024;
        }
        return $"{Math.Round(len, 2)} {sizes[order]}";
    }
}
