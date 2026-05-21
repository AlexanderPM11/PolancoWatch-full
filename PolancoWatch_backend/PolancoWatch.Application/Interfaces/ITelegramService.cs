using PolancoWatch.Domain.Entities;
using System.Threading.Tasks;

namespace PolancoWatch.Application.Interfaces;

public interface ITelegramService
{
    Task SendMessageAsync(string message, NotificationSettings? settings = null);
}
