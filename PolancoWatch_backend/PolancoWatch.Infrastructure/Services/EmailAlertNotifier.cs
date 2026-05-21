using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using MimeKit;
using PolancoWatch.Application.Interfaces;
using PolancoWatch.Domain.Entities;

namespace PolancoWatch.Infrastructure.Services;

public class EmailAlertNotifier : IAlertNotifier
{
    private readonly IEmailService _emailService;
    private readonly ILogger<EmailAlertNotifier> _logger;

    public EmailAlertNotifier(ILogger<EmailAlertNotifier> logger, IEmailService emailService)
    {
        _logger = logger;
        _emailService = emailService;
    }

    public async Task NotifyAsync(AlertRule rule, string message, double currentValue, NotificationSettings settings)
    {
        if (!settings.EmailEnabled || string.IsNullOrEmpty(settings.SmtpHost) || string.IsNullOrEmpty(settings.ToEmail))
        {
            return;
        }

        try
        {
            var template = settings.EmailMessageTemplate;
            if (string.IsNullOrEmpty(template))
            {
                template = $@"
                    <div style='font-family: sans-serif; padding: 20px; border: 1px solid #ff4444; border-radius: 8px;'>
                        <h2 style='color: #ff4444;'>🚨 PolancoWatch Alert</h2>
                        <p><strong>Message:</strong> {{Message}}</p>
                        <hr/>
                        <p><strong>Metric:</strong> {{Metric}}</p>
                        <p><strong>Current Value:</strong> {{Value}}%</p>
                        <p><strong>Threshold:</strong> {{Threshold}}%</p>
                        <p><strong>Time:</strong> {{Time}} UTC</p>
                        <br/>
                        <p style='font-size: 12px; color: #666;'>This is an automated notification from your PolancoWatch instance.</p>
                    </div>";
            }

            var finalHtml = template
                .Replace("{Metric}", rule.MetricType.ToString())
                .Replace("{Value}", currentValue.ToString("F2"))
                .Replace("{Threshold}", rule.Threshold.ToString())
                .Replace("{Time}", DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss"))
                .Replace("{Message}", message);

            await _emailService.SendEmailAsync(settings.ToEmail, $"PolancoWatch Alert: {rule.MetricType} usage is high", finalHtml, settings);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending Email notification to {Recipient} for rule {RuleId}", settings.ToEmail, rule.Id);
        }
    }
}
