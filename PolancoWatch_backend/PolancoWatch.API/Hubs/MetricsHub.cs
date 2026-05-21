using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using PolancoWatch.Application.Interfaces;

namespace PolancoWatch.API.Hubs;

[Authorize]
public class MetricsHub : Hub<IMetricsClient>
{
    public override async Task OnConnectedAsync()
    {
        // TODO: Log or authenticate connections
        await base.OnConnectedAsync();
    }
    

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await base.OnDisconnectedAsync(exception);
    }
}
