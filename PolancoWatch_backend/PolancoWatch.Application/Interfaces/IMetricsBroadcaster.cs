using PolancoWatch.Domain.Models;

namespace PolancoWatch.Application.Interfaces;

public interface IMetricsBroadcaster
{
    Task BroadcastMetricsAsync(ServerMetricsSnapshot snapshot);
    // Removed BroadcastAlertAsync - to be handled by general IAlertNotifier implementations
}
