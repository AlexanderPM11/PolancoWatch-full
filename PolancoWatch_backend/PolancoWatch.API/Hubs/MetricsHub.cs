using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using PolancoWatch.Application.Interfaces;

namespace PolancoWatch.API.Hubs;

[Authorize]
public class MetricsHub : Hub<IMetricsClient>
{
    private readonly IMetricsCollector _metricsCollector;

    public MetricsHub(IMetricsCollector metricsCollector)
    {
        _metricsCollector = metricsCollector;
    }

    public override async Task OnConnectedAsync()
    {
        var snapshot = await _metricsCollector.CollectMetricsAsync();
        await Clients.Caller.ReceiveMetrics(snapshot);
        await base.OnConnectedAsync();
    }
    

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await base.OnDisconnectedAsync(exception);
    }
}
