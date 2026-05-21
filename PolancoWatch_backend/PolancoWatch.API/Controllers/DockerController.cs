using Docker.DotNet;
using Docker.DotNet.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PolancoWatch.Application.Interfaces;

namespace PolancoWatch.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class DockerController : ControllerBase
{
    private readonly ILogger<DockerController> _logger;
    private readonly IDockerClient _dockerClient;
    private readonly IMetricsCollector _metricsCollector;
    private readonly IMetricsBroadcaster _metricsBroadcaster;

    public DockerController(
        ILogger<DockerController> _logger, 
        IDockerClient dockerClient,
        IMetricsCollector metricsCollector,
        IMetricsBroadcaster metricsBroadcaster)
    {
        this._logger = _logger;
        _dockerClient = dockerClient;
        _metricsCollector = metricsCollector;
        _metricsBroadcaster = metricsBroadcaster;
    }

    [HttpPost("container/{id}/start")]
    public async Task<IActionResult> StartContainer(string id)
    {
        return await ExecuteDockerCommand(id, "start");
    }

    [HttpPost("container/{id}/stop")]
    public async Task<IActionResult> StopContainer(string id)
    {
        return await ExecuteDockerCommand(id, "stop");
    }

    [HttpPost("container/{id}/restart")]
    public async Task<IActionResult> RestartContainer(string id)
    {
        return await ExecuteDockerCommand(id, "restart");
    }

    private async Task<IActionResult> ExecuteDockerCommand(string id, string command)
    {
        try
        {
            switch (command.ToLower())
            {
                case "start":
                    await _dockerClient.Containers.StartContainerAsync(id, new ContainerStartParameters());
                    break;
                case "stop":
                    await _dockerClient.Containers.StopContainerAsync(id, new ContainerStopParameters());
                    break;
                case "restart":
                    await _dockerClient.Containers.RestartContainerAsync(id, new ContainerRestartParameters());
                    break;
                default:
                    return BadRequest($"Unknown command: {command}");
            }

            // Trigger immediate broadcast to update UI instantly
            try {
                var snapshot = await _metricsCollector.CollectMetricsAsync();
                await _metricsBroadcaster.BroadcastMetricsAsync(snapshot);
            } catch (Exception ex) {
                _logger.LogWarning(ex, "Failed to trigger immediate broadcast after {Command}", command);
            }

            return Ok(new { message = $"Container {id} {command}ed successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error executing docker {Command} for {Id}", command, id);
            return StatusCode(500, new { message = ex.Message });
        }
    }
}
