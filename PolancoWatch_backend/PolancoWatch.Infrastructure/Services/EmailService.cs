using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using MimeKit;
using PolancoWatch.Application.Interfaces;
using PolancoWatch.Domain.Entities;

namespace PolancoWatch.Infrastructure.Services;

public class EmailService : IEmailService
{
    private readonly ILogger<EmailService> _logger;

    public EmailService(ILogger<EmailService> logger)
    {
        _logger = logger;
    }

    public async Task SendEmailAsync(string to, string subject, string body, NotificationSettings? settings = null)
    {
        if (settings == null || !settings.EmailEnabled || string.IsNullOrEmpty(settings.SmtpHost))
        {
            _logger.LogWarning("Email service attempted to send email but settings are missing or disabled.");
            return;
        }

        try
        {
            var email = new MimeMessage();
            email.From.Add(MailboxAddress.Parse(settings.FromEmail ?? "alerts@polancowatch.com"));
            email.To.Add(MailboxAddress.Parse(to));
            email.Subject = subject;

            var bodyBuilder = new BodyBuilder
            {
                HtmlBody = body
            };

            email.Body = bodyBuilder.ToMessageBody();

            using var smtp = new SmtpClient();
            var options = settings.SmtpEnableSsl ? SecureSocketOptions.StartTls : SecureSocketOptions.None;
            
            await smtp.ConnectAsync(settings.SmtpHost, settings.SmtpPort, options);
            
            if (!string.IsNullOrEmpty(settings.SmtpUser) && !string.IsNullOrEmpty(settings.SmtpPass))
            {
                await smtp.AuthenticateAsync(settings.SmtpUser, settings.SmtpPass);
            }

            await smtp.SendAsync(email);
            await smtp.DisconnectAsync(true);

            _logger.LogInformation("Email sent successfully to {Recipient}", to);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending Email to {Recipient}", to);
        }
    }
}
