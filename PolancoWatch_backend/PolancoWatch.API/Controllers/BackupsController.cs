using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using PolancoWatch.Infrastructure.Services;
using PolancoWatch.Domain.Entities;
using Docker.DotNet;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using PolancoWatch.Infrastructure.Data;
using PolancoWatch.Application.Interfaces;
using PolancoWatch.Application.DTOs;
using PolancoWatch.Infrastructure.Helpers;
using System.Security.Cryptography;
using System.Text;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Hangfire;

namespace PolancoWatch.API.Controllers;

[Authorize(Roles = "Admin")]
[ApiController]
[Route("api/[controller]")]
public class BackupsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly BackupManager _backupManager;
    private readonly IBackupService _backupService;
    private readonly IConfiguration _configuration;
    private readonly IDockerClient _dockerClient;
    private readonly IGoogleDriveService _driveService;
    private readonly ILogger<BackupsController> _logger;
    private readonly IBackgroundJobClient _backgroundJobs;
    private readonly IRecurringJobManager _recurringJobs;

    public BackupsController(ApplicationDbContext context, BackupManager backupManager, IBackupService backupService, IConfiguration configuration, IDockerClient dockerClient, IGoogleDriveService driveService, ILogger<BackupsController> logger, IBackgroundJobClient backgroundJobs, IRecurringJobManager recurringJobs)
    {
        _context = context;
        _backupManager = backupManager;
        _backupService = backupService;
        _configuration = configuration;
        _dockerClient = dockerClient;
        _driveService = driveService;
        _logger = logger;
        _backgroundJobs = backgroundJobs;
        _recurringJobs = recurringJobs;
    }

    // --- Google Drive OAuth ---

    [HttpGet("drive/auth-url")]
    public IActionResult GetDriveAuthUrl()
    {
        try
        {
            var redirectUri = Environment.GetEnvironmentVariable("GOOGLE_DRIVE_REDIRECT_URI")
                           ?? $"{Request.Scheme}://{Request.Host}/api/backups/drive/callback";
            var url = _driveService.GetAuthUrl(redirectUri, CreateDriveOAuthState());
            return Ok(new { url });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to create Google Drive authorization URL.");
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("drive/callback")]
    [AllowAnonymous] // Google redirects here, no JWT
    public async Task<IActionResult> DriveOAuthCallback([FromQuery] string? code, [FromQuery] string? state, [FromQuery] string? error)
    {
        if (!string.IsNullOrEmpty(error))
        {
            var safeError = System.Net.WebUtility.HtmlEncode(error);
            return Content($"<html><body><h2>Authorization failed: {safeError}</h2><p>You can close this tab.</p></body></html>", "text/html");
        }

        if (string.IsNullOrEmpty(code))
            return BadRequest("No authorization code received.");

        if (!ValidateDriveOAuthState(state, out var username))
            return BadRequest("Invalid or expired OAuth state.");

        try
        {
            var redirectUri = Environment.GetEnvironmentVariable("GOOGLE_DRIVE_REDIRECT_URI")
                           ?? $"{Request.Scheme}://{Request.Host}/api/backups/drive/callback";
            var refreshToken = await _driveService.ExchangeCodeForRefreshTokenAsync(code, redirectUri, username);
            var appUrl = _configuration["APP_URL"] ?? "http://localhost:5246";

            return Content($@"
<!DOCTYPE html>
<html lang='en'>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>PolancoWatch - Drive Connected</title>
    <link href='https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap' rel='stylesheet'>
    <style>
        :root {{ --brand: #a78bfa; --bg: #0d0d1a; --card: rgba(255, 255, 255, 0.05); }}
        body {{ 
            font-family: 'Inter', sans-serif; 
            background-color: var(--bg); 
            background-image: radial-gradient(circle at top right, #1e1b4b, transparent), 
                              radial-gradient(circle at bottom left, #0f172a, transparent);
            color: white; height: 100vh; margin: 0; 
            display: flex; align-items: center; justify-content: center; overflow: hidden;
        }}
        .card {{
            background: var(--card); backdrop-filter: blur(12px);
            border: 1px solid rgba(255,255,255,0.1); border-radius: 40px;
            padding: 60px; text-align: center; max-width: 450px; width: 90%;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }}
        .icon-circle {{
            width: 80px; height: 80px; background: rgba(167, 139, 250, 0.1);
            border-radius: 100%; display: flex; align-items: center; justify-content: center;
            margin: 0 auto 30px; border: 1px solid var(--brand);
            box-shadow: 0 0 20px rgba(167, 139, 250, 0.2);
            animation: scaleIn 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }}
        .icon-check {{ font-size: 40px; color: var(--brand); }}
        h1 {{ font-size: 28px; font-weight: 900; margin: 0 0 16px; letter-spacing: -1px; }}
        p {{ font-size: 15px; color: #94a3b8; line-height: 1.6; margin: 0 0 40px; }}
        .btn {{
            display: inline-block; background: var(--brand); color: #000;
            padding: 16px 32px; border-radius: 20px; font-weight: 700; font-size: 14px;
            text-decoration: none; transition: all 0.3s; box-shadow: 0 10px 15px -3px rgba(167, 139, 250, 0.3);
        }}
        .btn:hover {{ transform: translateY(-2px); filter: brightness(1.1); box-shadow: 0 20px 25px -5px rgba(167, 139, 250, 0.4); }}
        @keyframes fadeIn {{ from {{ opacity: 0; transform: translateY(20px); }} to {{ opacity: 1; transform: translateY(0); }} }}
        @keyframes scaleIn {{ from {{ transform: scale(0.5); opacity: 0; }} to {{ transform: scale(1); opacity: 1; }} }}
    </style>
</head>
<body>
    <div class='card'>
        <div class='icon-circle'><div class='icon-check'>&#10003;</div></div>
        <h1>PolancoVault Sync</h1>
        <p>Google Drive connection successful. Your manual and automated backups will now be relayed to the cloud cloud automatically.</p>
        <a href='{appUrl}/backups' class='btn'>Back to Dashboard</a>
    </div>
</body>
</html>", "text/html");
        }
        catch (Exception ex)
        {
            var appUrl = _configuration["APP_URL"] ?? "http://localhost:5246";
            var safeMessage = System.Net.WebUtility.HtmlEncode(ex.Message);
            return Content($@"
<!DOCTYPE html>
<html lang='en'>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>Connection Failed</title>
    <link href='https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap' rel='stylesheet'>
    <style>
        :root {{ --error: #f43f5e; --bg: #0d0d1a; --card: rgba(255, 255, 255, 0.05); }}
        body {{ font-family: 'Inter', sans-serif; background: var(--bg); color: white; height: 100vh; margin: 0; display: flex; align-items: center; justify-content: center; }}
        .card {{ background: var(--card); border: 1px solid rgba(255,0,0,0.1); border-radius: 40px; padding: 60px; text-align: center; max-width: 450px; width: 90%; }}
        .icon-circle {{ width: 80px; height: 80px; background: rgba(244, 63, 94, 0.1); border-radius: 100%; display: flex; align-items: center; justify-content: center; margin: 0 auto 30px; border: 1px solid var(--error); }}
        .icon-error {{ font-size: 30px; color: var(--error); font-weight: 900; }}
        h1 {{ font-size: 24px; font-weight: 900; margin: 0 0 16px; color: var(--error); }}
        p {{ font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0 0 30px; word-break: break-all; }}
        .btn {{ display: inline-block; background: rgba(255,255,255,0.1); color: white; padding: 12px 24px; border-radius: 16px; font-size: 12px; font-weight: 700; text-decoration: none; }}
    </style>
</head>
<body>
    <div class='card'>
        <div class='icon-circle'><div class='icon-error'>!</div></div>
        <h1>Connection Failed</h1>
        <p>{safeMessage}</p>
        <a href='{appUrl}/backups' class='btn'>Try Again</a>
    </div>
</body>
</html>", "text/html");
        }
    }

    private string CreateDriveOAuthState()
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
        var nonce = Convert.ToBase64String(RandomNumberGenerator.GetBytes(16));
        var username = User.Identity?.Name ?? "admin";
        var payload = $"{timestamp}.{nonce}.{username}";
        var signature = SignDriveOAuthState(payload);
        return Convert.ToBase64String(Encoding.UTF8.GetBytes($"{payload}.{signature}"));
    }

    private bool ValidateDriveOAuthState(string? state, out string username)
    {
        username = "admin";
        if (string.IsNullOrWhiteSpace(state)) return false;

        try
        {
            var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(state));
            var parts = decoded.Split('.');
            if (parts.Length != 4) return false;

            var payload = $"{parts[0]}.{parts[1]}.{parts[2]}";
            username = parts[2];
            var expectedSignature = SignDriveOAuthState(payload);
            if (!CryptographicOperations.FixedTimeEquals(
                    Encoding.UTF8.GetBytes(parts[3]),
                    Encoding.UTF8.GetBytes(expectedSignature)))
            {
                return false;
            }

            if (!long.TryParse(parts[0], out var timestamp)) return false;
            var issuedAt = DateTimeOffset.FromUnixTimeSeconds(timestamp);
            return DateTimeOffset.UtcNow - issuedAt <= TimeSpan.FromMinutes(10);
        }
        catch
        {
            return false;
        }
    }

    private string SignDriveOAuthState(string payload)
    {
        var key = Environment.GetEnvironmentVariable("JWT_KEY")
                  ?? Environment.GetEnvironmentVariable("JWT_SECRET")
                  ?? _configuration["Jwt:Key"]
                  ?? throw new InvalidOperationException("JWT key is required to sign OAuth state.");

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(key));
        return Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(payload)));
    }

    [HttpGet("drive/status")]
    public async Task<IActionResult> GetDriveStatus()
    {
        var username = User.Identity?.Name ?? "admin";
        var isAuthenticated = await _driveService.IsAuthenticatedAsync(username);
        return Ok(new { isAuthenticated });
    }

    [HttpDelete("drive/auth")]
    public async Task<IActionResult> RevokeDriveAuth()
    {
        var username = User.Identity?.Name ?? "admin";
        await _driveService.RevokeAuthAsync(username);
        return Ok(new { message = "Google Drive authorization revoked." });
    }

    [HttpGet("config/volumes")]
    public async Task<ActionResult<IEnumerable<object>>> GetAvailableVolumes()
    {
        var volumesList = new List<object>();
        
        try
        {
            var volumes = await _dockerClient.Volumes.ListAsync();
            foreach (var volume in volumes.Volumes)
            {
                if (!string.IsNullOrEmpty(volume.Mountpoint))
                {
                    volumesList.Add(new { 
                        Name = volume.Name, 
                        Path = volume.Mountpoint 
                    });
                }
            }
        }
        catch (Exception)
        {
            // Log error
        }

        return Ok(volumesList);
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Backup>>> GetBackups()
    {
        return await _context.Backups.OrderByDescending(b => b.CreatedAt).ToListAsync();
    }

    [HttpGet("config/containers")]
    public async Task<ActionResult<IEnumerable<object>>> GetAvailableContainers()
    {
        var containersList = new List<object>();
        try
        {
            var dbImageKeywords = new[] { "mysql", "mariadb", "postgres", "mongo", "redis", "mssql", "sql-server", "cockroach", "percona" };
            var containers = await _dockerClient.Containers.ListContainersAsync(new Docker.DotNet.Models.ContainersListParameters { All = true });
            foreach (var container in containers)
            {
                var imageLower = container.Image?.ToLowerInvariant() ?? "";
                if (!dbImageKeywords.Any(kw => imageLower.Contains(kw)))
                    continue;

                containersList.Add(new {
                    Id = container.ID,
                    Name = container.Names != null && container.Names.Count > 0 ? container.Names[0].TrimStart('/') : container.ID.Substring(0, 12),
                    State = container.State,
                    Image = container.Image
                });
            }
        }
        catch (Exception)
        {
            // Log error
        }
        return Ok(containersList);
    }

    /// <summary>
    /// Retrieves the list of databases in a container.
    /// Credentials are sent in the request body (POST) to avoid logging passwords in query strings.
    /// </summary>
    [HttpPost("config/containers/{containerId}/databases")]
    public async Task<ActionResult<IEnumerable<string>>> GetContainerDatabases(string containerId, [FromBody] DbCredentialsRequest? credentials)
    {
        try
        {
            var user = credentials?.User ?? "root";
            var pass = credentials?.Pass;
            var databases = await _backupService.GetContainerDatabasesAsync(containerId, user, pass);
            return Ok(databases);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing databases for container {ContainerId}", containerId);
            return StatusCode(500, new { message = "An error occurred while listing the databases." });
        }
    }

    [HttpPost("database")]
    public IActionResult TriggerDatabaseBackup([FromQuery] BackupFormat format = BackupFormat.Zip, [FromQuery] string? target = null, [FromQuery] bool syncToCloud = false, [FromQuery] string? cloudFolderId = null, [FromQuery] string? backupName = null, [FromQuery] bool keepLocal = true, [FromQuery] int retentionCount = 0, [FromQuery] bool sendTelegram = false)
    {
        try
        {
            var username = User.Identity?.Name ?? "admin";
            var jobId = _backgroundJobs.Enqueue<BackupManager>(manager => 
                manager.RunBackupAsync(BackupType.Database, target, format, syncToCloud, cloudFolderId, backupName, keepLocal, retentionCount, sendTelegram, username));
            
            return Accepted(new { message = "Database backup queued successfully.", jobId });
        }
        catch (Exception)
        {
            return BadRequest();
        }
    }

    [HttpPost("volume")]
    public IActionResult TriggerVolumeBackup([FromQuery] string target, [FromQuery] BackupFormat format = BackupFormat.Zip, [FromQuery] bool syncToCloud = false, [FromQuery] string? cloudFolderId = null, [FromQuery] string? backupName = null, [FromQuery] bool keepLocal = true, [FromQuery] int retentionCount = 0, [FromQuery] bool sendTelegram = false)
    {
        try
        {
            var username = User.Identity?.Name ?? "admin";
            var jobId = _backgroundJobs.Enqueue<BackupManager>(manager => 
                manager.RunBackupAsync(BackupType.Volume, target, format, syncToCloud, cloudFolderId, backupName, keepLocal, retentionCount, sendTelegram, username));
            
            return Accepted(new { message = "Volume backup queued successfully.", jobId });
        }
        catch (Exception)
        {
            return BadRequest();
        }
    }

    [HttpGet("schedules")]
    public async Task<ActionResult<IEnumerable<BackupSchedule>>> GetSchedules()
    {
        return await _context.BackupSchedules.ToListAsync();
    }

    [HttpPost("schedules")]
    public async Task<ActionResult<BackupSchedule>> CreateSchedule(BackupSchedule schedule)
    {
        schedule.Id = Guid.NewGuid();
        schedule.NextRun = ScheduleHelper.CalculateNextRun(schedule, DateTimeOffset.UtcNow);
        _context.BackupSchedules.Add(schedule);
        await _context.SaveChangesAsync();
        if (schedule.IsActive)
        {
            _recurringJobs.AddOrUpdate<BackupManager>(
                $"backup_{schedule.Id}", 
                manager => manager.RunBackupAsync(schedule.Type, schedule.Target, schedule.Format, schedule.SyncToCloud, schedule.CloudFolderId, null, schedule.KeepLocal, schedule.RetentionCount, schedule.SendTelegram, "system"), 
                ScheduleHelper.GetCronFromSchedule(schedule));
        }
        
        return CreatedAtAction(nameof(GetSchedules), new { id = schedule.Id }, schedule);
    }

    [HttpPut("schedules/{id}")]
    public async Task<IActionResult> UpdateSchedule(Guid id, BackupSchedule schedule)
    {
        if (id != schedule.Id) return BadRequest();
        
        var existing = await _context.BackupSchedules.FindAsync(id);
        if (existing == null) return NotFound();

        // Name is immutable after creation to preserve cloud folder mapping
        // existing.Name = schedule.Name;
        existing.Type = schedule.Type;
        existing.Target = schedule.Target;
        existing.IntervalMinutes = schedule.IntervalMinutes;
        existing.SyncToCloud = schedule.SyncToCloud;
        existing.CloudFolderId = schedule.CloudFolderId;
        existing.KeepLocal = schedule.KeepLocal;
        existing.UseCron = schedule.UseCron;
        existing.CronExpression = schedule.CronExpression;
        existing.IsActive = schedule.IsActive;
        existing.SendTelegram = schedule.SendTelegram;
        existing.RetentionCount = schedule.RetentionCount;
        existing.Format = schedule.Format;

        // Recalculate next run if scheduling changed
        existing.NextRun = ScheduleHelper.CalculateNextRun(existing, DateTimeOffset.UtcNow);

        await _context.SaveChangesAsync();
        if (existing.IsActive)
        {
            _recurringJobs.AddOrUpdate<BackupManager>(
                $"backup_{existing.Id}", 
                manager => manager.RunBackupAsync(existing.Type, existing.Target, existing.Format, existing.SyncToCloud, existing.CloudFolderId, null, existing.KeepLocal, existing.RetentionCount, existing.SendTelegram, "system"), 
                ScheduleHelper.GetCronFromSchedule(existing));
        }
        else
        {
            _recurringJobs.RemoveIfExists($"backup_{existing.Id}");
        }
        
        return NoContent();
    }

    [HttpDelete("schedules/{id}")]
    public async Task<IActionResult> DeleteSchedule(Guid id)
    {
        var schedule = await _context.BackupSchedules.FindAsync(id);
        if (schedule == null) return NotFound();

        _recurringJobs.RemoveIfExists($"backup_{id}");

        _context.BackupSchedules.Remove(schedule);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("schedules/{id}/execute")]
    public async Task<IActionResult> ExecuteSchedule(Guid id)
    {
        var schedule = await _context.BackupSchedules.FindAsync(id);
        if (schedule == null) return NotFound("Protocol not found.");

        try
        {
            var username = User.Identity?.Name ?? "admin";
            var jobId = _backgroundJobs.Enqueue<BackupManager>(manager => 
                manager.RunBackupAsync(schedule.Type, schedule.Target, schedule.Format, schedule.SyncToCloud, schedule.CloudFolderId, schedule.Name, schedule.KeepLocal, schedule.RetentionCount, schedule.SendTelegram, username));
                
            return Accepted(new { message = "Backup initiated from schedule.", jobId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error triggering execution for schedule {ScheduleId}", id);
            return BadRequest(new { message = "Failed to initiate backup from schedule." });
        }
    }

    [HttpGet("{id}/download")]
    public async Task<IActionResult> DownloadBackup(Guid id)
    {
        var backup = await _context.Backups.FindAsync(id);
        if (backup == null || !System.IO.File.Exists(backup.FilePath))
            return NotFound("Backup file not found.");

        var bytes = await System.IO.File.ReadAllBytesAsync(backup.FilePath);
        return File(bytes, "application/octet-stream", Path.GetFileName(backup.FilePath));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteBackup(Guid id)
    {
        var backup = await _context.Backups.FindAsync(id);
        if (backup == null) return NotFound();

        // Local deletion
        await _backupService.DeleteBackupFileAsync(backup.FilePath);

        _context.Backups.Remove(backup);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
