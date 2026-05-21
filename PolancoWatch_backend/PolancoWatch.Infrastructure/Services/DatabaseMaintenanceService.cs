using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PolancoWatch.Infrastructure.Data;

namespace PolancoWatch.Infrastructure.Services
{
    public class DatabaseMaintenanceService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<DatabaseMaintenanceService> _logger;

        public DatabaseMaintenanceService(ApplicationDbContext context, ILogger<DatabaseMaintenanceService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task CleanOldDataAsync()
        {
            _logger.LogInformation("Starting Database Maintenance: Cleaning old data and vacuuming.");

            try
            {
                var thresholdDate = DateTime.UtcNow.AddDays(-30);

                // 1. Delete old HistoricalMetrics
                var deletedMetrics = await _context.HistoricalMetrics
                    .Where(m => m.Timestamp < thresholdDate)
                    .ExecuteDeleteAsync();

                _logger.LogInformation($"Deleted {deletedMetrics} old HistoricalMetrics.");

                // 2. Delete old WebChecks
                var deletedWebChecks = await _context.WebChecks
                    .Where(w => w.Timestamp < thresholdDate)
                    .ExecuteDeleteAsync();

                _logger.LogInformation($"Deleted {deletedWebChecks} old WebChecks.");

                // 3. VACUUM the SQLite database to reclaim space
                _logger.LogInformation("Executing VACUUM on SQLite database...");
                await _context.Database.ExecuteSqlRawAsync("VACUUM;");
                _logger.LogInformation("Database Maintenance completed successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred during Database Maintenance.");
                throw;
            }
        }
    }
}
