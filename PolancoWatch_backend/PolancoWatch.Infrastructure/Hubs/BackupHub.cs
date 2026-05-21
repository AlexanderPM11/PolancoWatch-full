using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System;
using System.Threading.Tasks;

namespace PolancoWatch.Infrastructure.Hubs;

[Authorize]
public class BackupHub : Hub
{
    public async Task SendProgress(Guid backupId, int percentage, string message)
    {
        await Clients.All.SendAsync("ReceiveBackupProgress", backupId, percentage, message);
    }
}
