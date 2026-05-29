using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using PolancoWatch.Application.Interfaces;
using PolancoWatch.Domain.Entities;
using Docker.DotNet;
using Docker.DotNet.Models;
using System.Collections.Generic;

namespace PolancoWatch.Infrastructure.Services.RestoreStrategies;

public class WordPressStorageRestoreStrategy : IRestoreStrategy
{
    private readonly IDockerClient _dockerClient;
    private readonly ILogger<WordPressStorageRestoreStrategy> _logger;

    public WordPressStorageRestoreStrategy(IDockerClient dockerClient, ILogger<WordPressStorageRestoreStrategy> logger)
    {
        _dockerClient = dockerClient;
        _logger = logger;
    }

    public bool CanHandle(RestoreType type)
    {
        return type == RestoreType.WordPressStorage;
    }

    public async Task ExecuteRestoreAsync(RestoreContext context)
    {
        var targetContainer = await InspectContainerAsync(context.TargetContainer);
        
        var targetMount = targetContainer.Mounts.FirstOrDefault(m => m.Destination == "/var/www/html" || m.Destination.Contains("wp-content"));
        if (targetMount == null)
        {
            throw new Exception("Could not find a bind mount for WordPress (/var/www/html or wp-content) on the target container.");
        }
        string targetHostPath = targetMount.Source;

        string myContainerId = Environment.MachineName;
        var myContainer = await _dockerClient.Containers.InspectContainerAsync(myContainerId);
        var backupsMount = myContainer.Mounts.FirstOrDefault(m => m.Destination == "/app/backups" || m.Destination == "/app/data");
        if (backupsMount == null)
        {
            throw new Exception("Could not detect the backups volume mounted to PolancoWatch.");
        }
        
        string relativeFilePath = Path.GetRelativePath(backupsMount.Destination, context.FilePath).Replace("\\", "/");

        var binds = new List<string>
        {
            $"{targetHostPath}:/target_storage"
        };

        if (backupsMount.Type == "volume")
        {
            binds.Add($"{backupsMount.Name}:/backups_source");
        }
        else
        {
            binds.Add($"{backupsMount.Source}:/backups_source");
        }

        string cmd = $"rm -rf /target_storage/* && tar -xzf /backups_source/{relativeFilePath} -C /target_storage/ && chown -R www-data:www-data /target_storage || chown -R 33:33 /target_storage";

        _logger.LogInformation("Launching ephemeral Alpine container to execute tar extraction for WordPress...");
        var createParams = new CreateContainerParameters
        {
            Image = "alpine:latest",
            Cmd = new[] { "sh", "-c", cmd },
            HostConfig = new HostConfig
            {
                Binds = binds,
                AutoRemove = true
            }
        };

        try
        {
            await _dockerClient.Images.CreateImageAsync(new ImagesCreateParameters { FromImage = "alpine", Tag = "latest" }, null, new Progress<JSONMessage>());
        }
        catch { }

        var response = await _dockerClient.Containers.CreateContainerAsync(createParams);
        await _dockerClient.Containers.StartContainerAsync(response.ID, new ContainerStartParameters());

        var waitResponse = await _dockerClient.Containers.WaitContainerAsync(response.ID);
        if (waitResponse.StatusCode != 0)
        {
            throw new Exception($"Ephemeral tar extraction container failed with exit code {waitResponse.StatusCode}");
        }

        _logger.LogInformation("Restarting WordPress container: {ContainerName}", context.TargetContainer);
        await _dockerClient.Containers.RestartContainerAsync(targetContainer.ID, new ContainerRestartParameters());
    }

    private async Task<ContainerInspectResponse> InspectContainerAsync(string target)
    {
        var containers = await _dockerClient.Containers.ListContainersAsync(new ContainersListParameters { All = true });
        var matched = containers.FirstOrDefault(c => c.Names != null && c.Names.Any(n => n.TrimStart('/') == target || n == target));
        if (matched != null)
        {
            return await _dockerClient.Containers.InspectContainerAsync(matched.ID);
        }
        throw new Exception($"Container not found: {target}");
    }
}
