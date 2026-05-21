using Microsoft.AspNetCore.SignalR;
using PolancoWatch.API.Hubs;
using PolancoWatch.Application.Interfaces;
using PolancoWatch.Domain.Entities;

namespace PolancoWatch.API.Services;

public class SignalRAlertNotifier : IAlertNotifier
{
    private readonly IHubContext<MetricsHub, IMetricsClient> _hubContext;

    public SignalRAlertNotifier(IHubContext<MetricsHub, IMetricsClient> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task NotifyAsync(AlertRule rule, string message, double currentValue, NotificationSettings settings)
    {
        await _hubContext.Clients.All.ReceiveAlert(message);
    }
}
