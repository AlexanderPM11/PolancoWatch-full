using Microsoft.Extensions.Logging;
using PolancoWatch.Application.Interfaces;
using PolancoWatch.Domain.Entities;
using System.Text;
using System.Text.Json;

namespace PolancoWatch.Infrastructure.Services;

public class TelegramAlertNotifier : IAlertNotifier
{
    private readonly ITelegramService _telegramService;
    private readonly ILogger<TelegramAlertNotifier> _logger;

    public TelegramAlertNotifier(ILogger<TelegramAlertNotifier> logger, ITelegramService telegramService)
    {
        _logger = logger;
        _telegramService = telegramService;
    }

    public async Task NotifyAsync(AlertRule rule, string message, double currentValue, NotificationSettings settings)
    {
        if (!settings.TelegramEnabled || string.IsNullOrEmpty(settings.TelegramBotToken) || string.IsNullOrEmpty(settings.TelegramChatId))
        {
            return;
        }

        try
        {
            var template = settings.TelegramMessageTemplate;
            if (string.IsNullOrEmpty(template))
            {
                template = "🚨 *PolancoWatch Alert*\n\n{Message}\n\n*Metric:* {Metric}\n*Value:* {Value}%\n*Threshold:* {Threshold}%\n*Date:* {Time} UTC";
            }

            var finalMessage = template
                .Replace("{Metric}", rule.MetricType.ToString())
                .Replace("{Value}", currentValue.ToString("F2"))
                .Replace("{Threshold}", rule.Threshold.ToString())
                .Replace("{Time}", DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss"))
                .Replace("{Message}", message);

            await _telegramService.SendMessageAsync(finalMessage, settings);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending Telegram notification for rule {RuleId}", rule.Id);
        }
    }
}
