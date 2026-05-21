using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using PolancoWatch.Application.Interfaces;
using PolancoWatch.Domain.Entities;

namespace PolancoWatch.Infrastructure.Services;

public class TelegramService : ITelegramService
{
    private readonly ILogger<TelegramService> _logger;
    private readonly HttpClient _httpClient;

    public TelegramService(ILogger<TelegramService> logger, HttpClient httpClient)
    {
        _logger = logger;
        _httpClient = httpClient;
    }

    public async Task SendMessageAsync(string message, NotificationSettings? settings = null)
    {
        if (settings == null || !settings.TelegramEnabled || string.IsNullOrEmpty(settings.TelegramBotToken) || string.IsNullOrEmpty(settings.TelegramChatId))
        {
            _logger.LogWarning("Telegram service attempted to send message but settings are missing or disabled.");
            return;
        }

        try
        {
            var url = $"https://api.telegram.org/bot{settings.TelegramBotToken}/sendMessage";
            var payload = new
            {
                chat_id = settings.TelegramChatId,
                text = message,
                parse_mode = "Markdown"
            };

            var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync(url, content);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogError("Failed to send Telegram message. Status: {Status}, Error: {Error}", response.StatusCode, error);
            }
            else
            {
                _logger.LogInformation("Telegram message sent successfully.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending Telegram message.");
        }
    }
}
