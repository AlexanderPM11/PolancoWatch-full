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

public class SupabaseStorageRestoreStrategy : IRestoreStrategy
{
    private readonly IDockerClient _dockerClient;
    private readonly ILogger<SupabaseStorageRestoreStrategy> _logger;

    public SupabaseStorageRestoreStrategy(IDockerClient dockerClient, ILogger<SupabaseStorageRestoreStrategy> logger)
    {
        _dockerClient = dockerClient;
        _logger = logger;
    }

    public bool CanHandle(RestoreType type)
    {
        return type == RestoreType.SupabaseStorage;
    }

    public async Task ExecuteRestoreAsync(RestoreContext context)
    {
        var targetContainer = await InspectContainerAsync(context.TargetContainer);
        
        // 1. Detect Host Path of Target Storage (/var/lib/storage)
        var targetMount = targetContainer.Mounts.FirstOrDefault(m => m.Destination == "/var/lib/storage");
        if (targetMount == null)
        {
            throw new Exception("Could not find a bind mount for /var/lib/storage on the target container.");
        }
        string targetHostPath = targetMount.Source;

        // 2. Detect Host Path/Volume Name of PolancoWatch backups volume
        string myContainerId = Environment.MachineName;
        var myContainer = await _dockerClient.Containers.InspectContainerAsync(myContainerId);
        var backupsMount = myContainer.Mounts.FirstOrDefault(m => m.Destination == "/app/backups" || m.Destination == "/app/data");
        if (backupsMount == null)
        {
            throw new Exception("Could not detect the backups volume mounted to PolancoWatch.");
        }
        
        // We need the relative path of the uploaded file inside the backups volume
        // Since FilePath is e.g. /app/backups/restores/file.tar.gz
        // And Destination is /app/backups, the relative path is restores/file.tar.gz
        string relativeFilePath = Path.GetRelativePath(backupsMount.Destination, context.FilePath).Replace("\\", "/");

        // 3. Launch Ephemeral Alpine Container
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

        string cmd = $"rm -rf /target_storage/* && tar --xattrs --xattrs-include='user.supabase.*' -xzf /backups_source/{relativeFilePath} -C /target_storage/ && chown -R root:root /target_storage";

        _logger.LogInformation("Launching ephemeral Alpine container to execute tar extraction...");
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

        // Ensure alpine image exists
        try
        {
            await _dockerClient.Images.CreateImageAsync(new ImagesCreateParameters { FromImage = "alpine", Tag = "latest" }, null, new Progress<JSONMessage>());
        }
        catch { }

        var response = await _dockerClient.Containers.CreateContainerAsync(createParams);
        await _dockerClient.Containers.StartContainerAsync(response.ID, new ContainerStartParameters());

        // Wait for it to finish
        var waitResponse = await _dockerClient.Containers.WaitContainerAsync(response.ID);
        if (waitResponse.StatusCode != 0)
        {
            throw new Exception($"Ephemeral tar extraction container failed with exit code {waitResponse.StatusCode}");
        }

        // 4. Restart Target Storage Container
        _logger.LogInformation("Restarting target storage container: {ContainerName}", context.TargetContainer);
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
