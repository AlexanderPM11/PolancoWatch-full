using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using PolancoWatch.Application.Interfaces;
using PolancoWatch.Domain.Entities;
using PolancoWatch.Domain.Common;
using PolancoWatch.Infrastructure.Data;
using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using System.Net;
using System.Net.Http;
using System;

namespace PolancoWatch.Infrastructure.Services;

public class WebMonitorHostedService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<WebMonitorHostedService> _logger;
    private readonly IHttpClientFactory _httpClientFactory;

    public WebMonitorHostedService(
        IServiceProvider serviceProvider,
        ILogger<WebMonitorHostedService> logger,
        IHttpClientFactory httpClientFactory)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Web Monitor Hosted Service is starting.");

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await PerformChecksAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while performing web monitor checks.");
            }
        }
    }

    private async Task PerformChecksAsync(CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var telegramService = scope.ServiceProvider.GetRequiredService<ITelegramService>();

        var monitors = await context.WebMonitors
            .Where(m => m.IsActive)
            .ToListAsync(ct);

        var settings = await context.NotificationSettings.FirstOrDefaultAsync(ct);

        var httpClient = _httpClientFactory.CreateClient("WebMonitor");
        httpClient.Timeout = TimeSpan.FromSeconds(10);
        
        // Add User-Agent to avoid being blocked as a bot
        if (!httpClient.DefaultRequestHeaders.Contains("User-Agent"))
        {
            httpClient.DefaultRequestHeaders.Add("User-Agent", "PolancoWatch/1.2 (+https://github.com/apolanco/PolancoWatch)");
        }

        foreach (var monitor in monitors)
        {
            if (monitor.LastCheckTime.HasValue && 
                monitor.LastCheckTime.Value.AddSeconds(monitor.CheckIntervalSeconds) > TimeHelper.Now)
            {
                continue;
            }

            var check = await ExecuteReliableCheckAsync(monitor, httpClient, ct);

            // Detect Status Change and Send Alerts
            var oldStatus = monitor.Status;
            
            check.IsSlow = check.IsUp && check.LatencyMs > monitor.SlowThresholdMs;

            // Double check for slowness to avoid jitter
            if (check.IsSlow)
            {
                _logger.LogInformation("Monitor {Name} detected slow response ({Latency}ms). Verifying...", monitor.Name, check.LatencyMs);
                var secondCheck = await RunSingleCheckAsync(monitor, httpClient, ct, 10);
                if (secondCheck.IsUp && secondCheck.LatencyMs > monitor.SlowThresholdMs)
                {
                    _logger.LogWarning("Monitor {Name} confirmed slow response ({Latency}ms).", monitor.Name, secondCheck.LatencyMs);
                    // Use the second check as the official result if still slow
                    check = secondCheck;
                    check.IsSlow = true;
                }
                else if (secondCheck.IsUp)
                {
                    _logger.LogInformation("Monitor {Name} slowness was temporary jitter. Second check: {Latency}ms.", monitor.Name, secondCheck.LatencyMs);
                    check = secondCheck;
                    check.IsSlow = false;
                }
            }

            if (!check.IsUp)
            {
                monitor.Status = WebMonitorStatus.Down;
            }
            else if (check.IsSlow)
            {
                monitor.Status = WebMonitorStatus.Slow;
            }
            else
            {
                monitor.Status = WebMonitorStatus.Up;
            }

            monitor.LastStatusUp = check.IsUp;
            monitor.LastCheckTime = TimeHelper.Now;
            monitor.LastLatencyMs = check.LatencyMs;

            if (monitor.Notify)
            {
                if (oldStatus != WebMonitorStatus.Down && monitor.Status == WebMonitorStatus.Down)
                {
                    await SendFailureAlert(monitor, check, telegramService, settings);
                }
                else if (oldStatus == WebMonitorStatus.Down && monitor.Status != WebMonitorStatus.Down)
                {
                    await SendRecoveryAlert(monitor, check, telegramService, settings);
                }
            }

            // Slowness Alerts
            if (monitor.Notify && monitor.NotifyOnSlow)
            {
                if (oldStatus != WebMonitorStatus.Slow && monitor.Status == WebMonitorStatus.Slow)
                {
                    await SendSlowAlert(monitor, check, telegramService, settings);
                }
                else if (oldStatus == WebMonitorStatus.Slow && monitor.Status == WebMonitorStatus.Up)
                {
                    await SendSlowRecoveryAlert(monitor, check, telegramService, settings);
                }
            }

            context.WebChecks.Add(check);
            await UpdateDailyStatsAsync(monitor, check, context, ct);
            await context.SaveChangesAsync(ct); // Save per monitor to ensure "Checking" state is visible
        }
    }

    private async Task<WebCheck> ExecuteReliableCheckAsync(WebMonitor monitor, HttpClient client, CancellationToken ct)
    {
        // 1. Initial Check
        var check = await RunSingleCheckAsync(monitor, client, ct, 10);
        
        if (check.IsUp) return check;

        // 2. Initial Fallback -> "Checking" state
        monitor.Status = WebMonitorStatus.Checking;
        // We don't save DB here yet because the loop in PerformChecksAsync handles the per-monitor save.
        // But to make it visible to UI immediately during retries, we might want to save.
        // Actually, let's keep it simple: if first fails, we do the retries.

        _logger.LogWarning("Monitor {Name} failed initial check. Starting retries...", monitor.Name);

        for (int i = 1; i <= 3; i++)
        {
            await Task.Delay(2000, ct); // 2s between retries
            var retryCheck = await RunSingleCheckAsync(monitor, client, ct, 10); // Use full timeout for retries
            
            if (retryCheck.IsUp)
            {
                _logger.LogInformation("Monitor {Name} recovered during retry {Attempt}", monitor.Name, i);
                return retryCheck;
            }
            _logger.LogWarning("Monitor {Name} retry {Attempt} failed: {Error}", monitor.Name, i, retryCheck.ErrorMessage);
        }

        return check; // Return the original failure if all retries failed
    }

    private async Task<WebCheck> RunSingleCheckAsync(WebMonitor monitor, HttpClient client, CancellationToken ct, int timeoutSeconds)
    {
        var check = new WebCheck
        {
            WebMonitorId = monitor.Id,
            Timestamp = TimeHelper.Now
        };

        var sw = Stopwatch.StartNew();
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds));

            if (Uri.TryCreate(monitor.Url, UriKind.Absolute, out var parsedUri))
            {
                // VULN-08: Resolve DNS and validate ALL resolved IPs against all private/reserved ranges
                // to prevent SSRF via DNS rebinding or hostname obfuscation
                await ValidateUrlNotSsrfAsync(parsedUri);
            }

            var response = await client.GetAsync(monitor.Url, cts.Token);
            sw.Stop();

            check.IsUp = response.IsSuccessStatusCode;
            check.StatusCode = (int)response.StatusCode;
            check.LatencyMs = sw.Elapsed.TotalMilliseconds;
        }
        catch (Exception ex)
        {
            sw.Stop();
            check.IsUp = false;
            check.StatusCode = 0;
            check.LatencyMs = sw.Elapsed.TotalMilliseconds;
            check.ErrorMessage = ex.Message;
        }
        return check;
    }

    private async Task SendFailureAlert(WebMonitor monitor, WebCheck check, ITelegramService telegram, NotificationSettings? settings)
    {
        var message = $"🔴 *Web Monitor Alert*\n\n" +
                      $"*Application Name:* {monitor.Name}\n" +
                      $"*URL:* {monitor.Url}\n" +
                      $"*Status:* DOWN ({(check.StatusCode > 0 ? check.StatusCode.ToString() : "Timeout/Error")})\n" +
                      $"*Error:* {check.ErrorMessage ?? "None"}\n" +
                      $"*Time:* {TimeHelper.Now:yyyy-MM-dd HH:mm:ss} (AST)";

        await telegram.SendMessageAsync(message, settings);
    }

    private async Task SendRecoveryAlert(WebMonitor monitor, WebCheck check, ITelegramService telegram, NotificationSettings? settings)
    {
        var message = $"🟢 *Web Monitor Recovered*\n\n" +
                      $"*Application Name:* {monitor.Name}\n" +
                      $"*URL:* {monitor.Url}\n" +
                      $"*Status:* UP ({check.StatusCode})\n" +
                      $"*Latency:* {check.LatencyMs:F0}ms\n" +
                      $"*Time:* {TimeHelper.Now:yyyy-MM-dd HH:mm:ss} (AST)";

        await telegram.SendMessageAsync(message, settings);
    }

    private async Task SendSlowAlert(WebMonitor monitor, WebCheck check, ITelegramService telegram, NotificationSettings? settings)
    {
        var message = $"🟠 *Web Monitor Slow Alert*\n\n" +
                      $"*Application Name:* {monitor.Name}\n" +
                      $"*URL:* {monitor.Url}\n" +
                      $"*Status:* SLOW ({check.LatencyMs:F0}ms)\n" +
                      $"*Threshold:* {monitor.SlowThresholdMs}ms\n" +
                      $"*Time:* {TimeHelper.Now:yyyy-MM-dd HH:mm:ss} (AST)";

        await telegram.SendMessageAsync(message, settings);
    }

    private async Task SendSlowRecoveryAlert(WebMonitor monitor, WebCheck check, ITelegramService telegram, NotificationSettings? settings)
    {
        var message = $"🟢 *Web Monitor Latency Recovered*\n\n" +
                      $"*Application Name:* {monitor.Name}\n" +
                      $"*URL:* {monitor.Url}\n" +
                      $"*Status:* UP ({check.LatencyMs:F0}ms)\n" +
                      $"*Threshold:* {monitor.SlowThresholdMs}ms\n" +
                      $"*Time:* {TimeHelper.Now:yyyy-MM-dd HH:mm:ss} (AST)";

        await telegram.SendMessageAsync(message, settings);
    }

    private async Task UpdateDailyStatsAsync(WebMonitor monitor, WebCheck check, ApplicationDbContext context, CancellationToken ct)
    {
        var today = DateTime.UtcNow.Date;
        var stats = await context.WebMonitorDailyStats
            .FirstOrDefaultAsync(s => s.WebMonitorId == monitor.Id && s.Date == today, ct);

        if (stats == null)
        {
            stats = new WebMonitorDailyStats
            {
                WebMonitorId = monitor.Id,
                Date = today,
                TotalChecks = 0
            };
            context.WebMonitorDailyStats.Add(stats);
        }

        stats.TotalChecks++;
        if (!check.IsUp) stats.DownCount++;
        else if (check.IsSlow) stats.SlowCount++;
        else stats.UpCount++;

        if (check.IsUp)
        {
            // Incremental average: (OldAvg * (Count-1) + NewVal) / Count
            // Note: TotalChecks is the count of ALL checks, but for latency we might want average of UP checks
            var upChecksCount = stats.UpCount + stats.SlowCount;
            if (upChecksCount == 1)
            {
                stats.AverageLatencyMs = check.LatencyMs;
            }
            else
            {
                stats.AverageLatencyMs = (stats.AverageLatencyMs * (upChecksCount - 1) + check.LatencyMs) / upChecksCount;
            }
        }

        stats.UpPercentage = (double)stats.UpCount / stats.TotalChecks * 100;
        stats.DownPercentage = (double)stats.DownCount / stats.TotalChecks * 100;
        stats.SlowPercentage = (double)stats.SlowCount / stats.TotalChecks * 100;
    }

    /// <summary>
    /// VULN-08: Resolves the hostname via DNS and validates that none of the resolved IP addresses
    /// fall within private, loopback, link-local or cloud metadata IP ranges.
    /// Prevents SSRF attacks via DNS rebinding or crafted hostnames like '10.evil.com'.
    /// </summary>
    private static async Task ValidateUrlNotSsrfAsync(Uri uri)
    {
        // Direct IP address: no DNS resolution needed
        if (System.Net.IPAddress.TryParse(uri.Host, out var directIp))
        {
            if (IsPrivateOrReservedIp(directIp))
                throw new InvalidOperationException($"SSRF Protection: The IP '{directIp}' is a private/reserved address and cannot be monitored.");
            return;
        }

        // Loopback hostnames (localhost, etc.)
        if (uri.IsLoopback)
            throw new InvalidOperationException("SSRF Protection: Loopback addresses are not allowed.");

        // Resolve DNS and validate EVERY returned IP
        System.Net.IPAddress[] addresses;
        try
        {
            addresses = await System.Net.Dns.GetHostAddressesAsync(uri.Host);
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"SSRF Protection: Could not resolve host '{uri.Host}': {ex.Message}");
        }

        foreach (var ip in addresses)
        {
            if (IsPrivateOrReservedIp(ip))
                throw new InvalidOperationException($"SSRF Protection: '{uri.Host}' resolves to private/reserved IP '{ip}' and cannot be monitored.");
        }
    }

    private static bool IsPrivateOrReservedIp(System.Net.IPAddress ip)
    {
        // Normalize IPv4-mapped IPv6 addresses
        if (ip.IsIPv4MappedToIPv6) ip = ip.MapToIPv4();

        if (ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
        {
            var b = ip.GetAddressBytes();
            return b[0] == 127                                    // 127.x.x.x Loopback
                || b[0] == 0                                      // 0.0.0.0
                || b[0] == 10                                     // 10.0.0.0/8
                || (b[0] == 172 && b[1] >= 16 && b[1] <= 31)    // 172.16.0.0/12 (Docker default bridge)
                || (b[0] == 192 && b[1] == 168)                  // 192.168.0.0/16
                || (b[0] == 169 && b[1] == 254);                 // 169.254.0.0/16 Link-local / AWS metadata
        }

        if (ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetworkV6)
        {
            if (System.Net.IPAddress.IsLoopback(ip)) return true; // ::1
            var b = ip.GetAddressBytes();
            if ((b[0] & 0xFE) == 0xFC) return true;              // fc00::/7 Unique local
            if (b[0] == 0xFE && (b[1] & 0xC0) == 0x80) return true; // fe80::/10 Link-local
        }

        return false;
    }
}
