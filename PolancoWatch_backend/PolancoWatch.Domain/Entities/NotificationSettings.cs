using System;
using System.ComponentModel.DataAnnotations;

namespace PolancoWatch.Domain.Entities;

public class NotificationSettings
{
    public int Id { get; set; }
    
    // Email
    public bool EmailEnabled { get; set; }
    [MaxLength(253)]
    public string? SmtpHost { get; set; }
    public int SmtpPort { get; set; }
    [MaxLength(256)]
    public string? SmtpUser { get; set; }
    [MaxLength(512)]
    public string? SmtpPass { get; set; }
    public bool SmtpEnableSsl { get; set; }
    [MaxLength(256)]
    public string? FromEmail { get; set; }
    [MaxLength(256)]
    public string? ToEmail { get; set; }
    [MaxLength(4000)]
    public string? EmailMessageTemplate { get; set; }

    // Telegram
    public bool TelegramEnabled { get; set; }
    [MaxLength(512)]
    public string? TelegramBotToken { get; set; }
    [MaxLength(64)]
    public string? TelegramChatId { get; set; }
    [MaxLength(4000)]
    public string? TelegramMessageTemplate { get; set; }
}
