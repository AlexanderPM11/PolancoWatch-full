using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PolancoWatch.Domain.Entities;
using PolancoWatch.Infrastructure.Data;

namespace PolancoWatch.API.Controllers;

[Authorize(Roles = "Admin")]
[ApiController]
[Route("api/[controller]")]
public class SettingsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public SettingsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("notifications")]
    public async Task<ActionResult<NotificationSettings>> GetNotificationSettings()
    {
        var settings = await _context.NotificationSettings.FirstOrDefaultAsync();
        if (settings == null)
        {
            settings = new NotificationSettings();
            _context.NotificationSettings.Add(settings);
            await _context.SaveChangesAsync();
        }
        return Ok(settings);
    }

    [HttpPut("notifications")]
    public async Task<IActionResult> UpdateNotificationSettings(NotificationSettings settings)
    {
        var existing = await _context.NotificationSettings.FirstOrDefaultAsync();
        if (existing == null)
        {
            _context.NotificationSettings.Add(settings);
        }
        else
        {
            existing.TelegramEnabled = settings.TelegramEnabled;
            existing.TelegramBotToken = settings.TelegramBotToken;
            existing.TelegramChatId = settings.TelegramChatId;
            existing.EmailEnabled = settings.EmailEnabled;
            existing.SmtpHost = settings.SmtpHost;
            existing.SmtpPort = settings.SmtpPort;
            existing.SmtpEnableSsl = settings.SmtpEnableSsl;
            existing.SmtpUser = settings.SmtpUser;
            existing.SmtpPass = settings.SmtpPass;
            existing.TelegramMessageTemplate = settings.TelegramMessageTemplate;
            existing.EmailMessageTemplate = settings.EmailMessageTemplate;
            existing.FromEmail = settings.FromEmail;
            existing.ToEmail = settings.ToEmail;
        }

        await _context.SaveChangesAsync();
        return NoContent();
    }
}
