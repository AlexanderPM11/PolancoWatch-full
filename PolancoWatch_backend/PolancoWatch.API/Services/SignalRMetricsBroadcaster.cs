using Microsoft.AspNetCore.SignalR;
using PolancoWatch.API.Hubs;
using PolancoWatch.Application.Interfaces;
using PolancoWatch.Domain.Models;

namespace PolancoWatch.API.Services;

public class SignalRMetricsBroadcaster : IMetricsBroadcaster
{
    private readonly IHubContext<MetricsHub, IMetricsClient> _hubContext;

    public SignalRMetricsBroadcaster(IHubContext<MetricsHub, IMetricsClient> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task BroadcastMetricsAsync(ServerMetricsSnapshot snapshot)
    {
        await _hubContext.Clients.All.ReceiveMetrics(snapshot);
    }
}
