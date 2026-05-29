using System;
using System.IO;
using System.Linq;
using System.Formats.Tar;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using PolancoWatch.Application.Interfaces;
using PolancoWatch.Domain.Entities;
using Docker.DotNet;
using Docker.DotNet.Models;

namespace PolancoWatch.Infrastructure.Services.RestoreStrategies;

public class SupabaseDatabaseRestoreStrategy : IRestoreStrategy
{
    private readonly IDockerClient _dockerClient;
    private readonly ILogger<SupabaseDatabaseRestoreStrategy> _logger;

    public SupabaseDatabaseRestoreStrategy(IDockerClient dockerClient, ILogger<SupabaseDatabaseRestoreStrategy> logger)
    {
        _dockerClient = dockerClient;
        _logger = logger;
    }

    public bool CanHandle(RestoreType type)
    {
        return type == RestoreType.SupabaseDatabase;
    }

    public async Task ExecuteRestoreAsync(RestoreContext context)
    {
        string containerId = await ResolveContainerIdAsync(context.TargetContainer);
        
        // 1. Pack the uploaded file into an in-memory TAR
        var fileInfo = new FileInfo(context.FilePath);
        if (!fileInfo.Exists)
        {
            throw new FileNotFoundException($"Uploaded restore file not found at {context.FilePath}");
        }

        string tempTarPath = Path.GetTempFileName();
        try
        {
            using (var tarStream = new FileStream(tempTarPath, FileMode.Create, FileAccess.Write))
            {
                using var writer = new TarWriter(tarStream, TarEntryFormat.Pax, leaveOpen: true);
                // Create a PaxTarEntry for the file
                var entry = new PaxTarEntry(TarEntryType.RegularFile, "restore.sql")
                {
                    DataStream = new FileStream(context.FilePath, FileMode.Open, FileAccess.Read)
                };
                await writer.WriteEntryAsync(entry);
            }

            // 2. Extract into container /tmp
            using (var tarStreamToUpload = new FileStream(tempTarPath, FileMode.Open, FileAccess.Read))
            {
                await _dockerClient.Containers.ExtractArchiveToContainerAsync(containerId, new ContainerPathStatParameters
                {
                    Path = "/tmp",
                    AllowOverwriteDirWithFile = true
                }, tarStreamToUpload, CancellationToken.None);
            }
        }
        finally
        {
            if (File.Exists(tempTarPath)) File.Delete(tempTarPath);
        }

        // 3. Construct the clean script
        string cleanScript = @"
ALTER ROLE postgres SUPERUSER;
DROP EXTENSION IF EXISTS pg_cron CASCADE;
DROP EXTENSION IF EXISTS pg_graphql CASCADE;
DROP EXTENSION IF EXISTS pg_net CASCADE;
DROP EXTENSION IF EXISTS pgjwt CASCADE;
DROP EXTENSION IF EXISTS supabase_vault CASCADE;
DROP EXTENSION IF EXISTS pgcrypto CASCADE;
DROP EXTENSION IF EXISTS ""uuid-ossp"" CASCADE;
DROP EXTENSION IF EXISTS pg_stat_statements CASCADE;
DROP EXTENSION IF EXISTS vector CASCADE;
DROP PUBLICATION IF EXISTS supabase_realtime;
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS auth CASCADE;
DROP SCHEMA IF EXISTS storage CASCADE;
DROP SCHEMA IF EXISTS extensions CASCADE;
DROP SCHEMA IF EXISTS graphql CASCADE;
DROP SCHEMA IF EXISTS graphql_public CASCADE;
DROP SCHEMA IF EXISTS realtime CASCADE;
DROP SCHEMA IF EXISTS _realtime CASCADE;
DROP SCHEMA IF EXISTS vault CASCADE;
DROP SCHEMA IF EXISTS pgbouncer CASCADE;
DROP SCHEMA IF EXISTS supabase_functions CASCADE;
DROP SCHEMA IF EXISTS cron CASCADE;
CREATE SCHEMA public;
";
        
        string dbUser = string.IsNullOrEmpty(context.DbUser) ? "supabase_admin" : context.DbUser;

        // Run the clean script
        await RunExecCommandAsync(containerId, new[] { "sh", "-c", $"echo '{cleanScript.Replace("'", "'\\''")}' | psql -U {dbUser} -d postgres" });

        // 4. Run the restore script
        _logger.LogInformation("Injecting SQL restore into Supabase DB...");
        await RunExecCommandAsync(containerId, new[] { "sh", "-c", $"psql -U {dbUser} -d postgres -f /tmp/restore.sql" });

        // 5. Revoke superuser and cleanup
        await RunExecCommandAsync(containerId, new[] { "sh", "-c", $"psql -U {dbUser} -d postgres -c \"ALTER ROLE postgres NOSUPERUSER;\"" });
        await RunExecCommandAsync(containerId, new[] { "rm", "-f", "/tmp/restore.sql" });
    }

    private async Task RunExecCommandAsync(string containerId, string[] cmd)
    {
        var execParams = new ContainerExecCreateParameters
        {
            AttachStdout = true,
            AttachStderr = true,
            Cmd = cmd
        };

        var execResponse = await _dockerClient.Exec.ExecCreateContainerAsync(containerId, execParams);
        using (var stream = await _dockerClient.Exec.StartAndAttachContainerExecAsync(execResponse.ID, false, CancellationToken.None))
        {
            var res = await stream.ReadOutputToEndAsync(CancellationToken.None);
            if (!string.IsNullOrEmpty(res.stderr))
            {
                bool isWarning = res.stderr.Contains("NOTICE:", StringComparison.OrdinalIgnoreCase) || 
                                 res.stderr.Contains("WARNING:", StringComparison.OrdinalIgnoreCase) ||
                                 res.stderr.Contains("does not exist, skipping", StringComparison.OrdinalIgnoreCase);

                if (!isWarning && res.stderr.Contains("ERROR:", StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogWarning("Command warning/error: {Stderr}", res.stderr);
                }
            }
        }
    }

    private async Task<string> ResolveContainerIdAsync(string target)
    {
        var containers = await _dockerClient.Containers.ListContainersAsync(new ContainersListParameters { All = true });
        var matched = containers.FirstOrDefault(c => c.Names != null && c.Names.Any(n => n.TrimStart('/') == target || n == target));
        if (matched != null) return matched.ID;
        throw new Exception($"Container not found: {target}");
    }
}
