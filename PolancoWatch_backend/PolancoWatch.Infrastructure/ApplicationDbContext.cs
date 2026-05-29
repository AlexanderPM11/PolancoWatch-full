using Microsoft.EntityFrameworkCore;
using PolancoWatch.Domain.Entities;
using System;
using System.Linq;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace PolancoWatch.Infrastructure.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users { get; set; } = null!;
    public DbSet<AlertRule> AlertRules { get; set; } = null!;
    public DbSet<AlertHistory> AlertHistories { get; set; } = null!;
    public DbSet<NotificationSettings> NotificationSettings { get; set; } = null!;
    public DbSet<HistoricalMetric> HistoricalMetrics { get; set; } = null!;
    public DbSet<WebMonitor> WebMonitors { get; set; } = null!;
    public DbSet<WebCheck> WebChecks { get; set; } = null!;
    public DbSet<Backup> Backups { get; set; } = null!;
    public DbSet<BackupSchedule> BackupSchedules { get; set; } = null!;
    public DbSet<WebMonitorDailyStats> WebMonitorDailyStats { get; set; } = null!;
    public DbSet<Restore> Restores { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Performance Indexes
        modelBuilder.Entity<HistoricalMetric>()
            .HasIndex(h => h.Timestamp);

        modelBuilder.Entity<WebCheck>()
            .HasIndex(w => new { w.WebMonitorId, w.Timestamp });
        
        // SQLite doesn't store timezone info. We force all DateTime properties to be Utc on read.
        var dateTimeConverter = new ValueConverter<DateTime, DateTime>(
            v => v,
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

        var nullableDateTimeConverter = new ValueConverter<DateTime?, DateTime?>(
            v => v,
            v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);

        // DateTimeOffset converter for SQLite (stores as string)
        var dateTimeOffsetConverter = new ValueConverter<DateTimeOffset, string>(
            v => v.ToString("O"),
            v => DateTimeOffset.Parse(v));

        var nullableDateTimeOffsetConverter = new ValueConverter<DateTimeOffset?, string?>(
            v => v.HasValue ? v.Value.ToString("O") : null,
            v => v != null ? DateTimeOffset.Parse(v) : null);

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (entityType.IsKeyless) continue;

            var properties = entityType.ClrType.GetProperties()
                .Where(p => p.PropertyType == typeof(DateTime) || 
                            p.PropertyType == typeof(DateTime?) ||
                            p.PropertyType == typeof(DateTimeOffset) ||
                            p.PropertyType == typeof(DateTimeOffset?));

            foreach (var property in properties)
            {
                if (property.PropertyType == typeof(DateTime))
                {
                    modelBuilder.Entity(entityType.ClrType)
                        .Property(property.Name)
                        .HasConversion(dateTimeConverter);
                }
                else if (property.PropertyType == typeof(DateTime?))
                {
                    modelBuilder.Entity(entityType.ClrType)
                        .Property(property.Name)
                        .HasConversion(nullableDateTimeConverter);
                }
                else if (property.PropertyType == typeof(DateTimeOffset))
                {
                    modelBuilder.Entity(entityType.ClrType)
                        .Property(property.Name)
                        .HasConversion(dateTimeOffsetConverter);
                }
                else if (property.PropertyType == typeof(DateTimeOffset?))
                {
                    modelBuilder.Entity(entityType.ClrType)
                        .Property(property.Name)
                        .HasConversion(nullableDateTimeOffsetConverter);
                }
            }
        }
    }
}
