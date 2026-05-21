using PolancoWatch.Domain.Entities;

namespace PolancoWatch.Application.Interfaces;

public interface IAlertNotifier
{
    Task NotifyAsync(AlertRule rule, string message, double currentValue, NotificationSettings settings);
}
