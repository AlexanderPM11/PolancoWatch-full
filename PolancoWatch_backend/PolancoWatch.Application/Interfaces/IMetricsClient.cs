using PolancoWatch.Domain.Models;

namespace PolancoWatch.Application.Interfaces;

public interface IMetricsClient
{
    Task ReceiveMetrics(ServerMetricsSnapshot metrics);
    Task ReceiveAlert(string message);
}
