using PolancoWatch.Domain.Models;

namespace PolancoWatch.Application.Interfaces;

public interface IMetricsCollector
{
    Task<ServerMetricsSnapshot> CollectMetricsAsync();
    Task<(bool Success, string Message)> KillProcessAsync(int pid);
}
