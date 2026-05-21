using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Docker.DotNet;
using Docker.DotNet.Models;
using Microsoft.Extensions.Logging;

namespace PolancoWatch.API.Hubs;

[Authorize]
public class LogsHub : Hub
{
    private readonly IDockerClient? _dockerClient;
    private readonly ILogger<LogsHub> _logger;

    public LogsHub(IDockerClient? dockerClient, ILogger<LogsHub> logger)
    {
        _dockerClient = dockerClient;
        _logger = logger;
    }

    public async Task GetContainerLogs(string containerId)
    {
        if (_dockerClient == null)
        {
            await Clients.Caller.SendAsync("LogReceived", "Error: Docker client not available.");
            return;
        }

        try
        {
            var parameters = new ContainerLogsParameters
            {
                ShowStdout = true,
                ShowStderr = true,
                Follow = true,
                Tail = "100"
            };

            var cts = new CancellationTokenSource();
            Context.Items["LogStreamToken"] = cts;

            using (var stream = await _dockerClient.Containers.GetContainerLogsAsync(containerId, false, parameters, cts.Token))
            {
                var buffer = new byte[8192];
                while (!cts.Token.IsCancellationRequested)
                {
                    var result = await stream.ReadOutputAsync(buffer, 0, buffer.Length, cts.Token);
                    if (result.EOF) break;

                    string logMessage = System.Text.Encoding.UTF8.GetString(buffer, 0, result.Count);
                    await Clients.Caller.SendAsync("LogReceived", logMessage);
                }
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Log streaming for container {ContainerId} cancelled.", containerId);
        }
        catch (Exception ex)
        {
            // Log the full technical detail server-side, never send it to the client
            _logger.LogError(ex, "Error streaming logs for container {ContainerId}", containerId);
            await Clients.Caller.SendAsync("LogReceived", "Error: Log streaming failed. Please try again or check the server logs.");
        }
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (Context.Items.TryGetValue("LogStreamToken", out var token) && token is CancellationTokenSource cts)
        {
            cts.Cancel();
            cts.Dispose();
        }
        await base.OnDisconnectedAsync(exception);
    }
}
