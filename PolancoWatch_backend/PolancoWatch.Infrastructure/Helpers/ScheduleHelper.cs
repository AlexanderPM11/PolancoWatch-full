using System;
using Cronos;
using PolancoWatch.Domain.Entities;

namespace PolancoWatch.Infrastructure.Helpers;

public static class ScheduleHelper
{
    public static TimeZoneInfo GetDominicanTimeZone()
    {
        // Windows: "SA Western Standard Time" (La Paz, Santo Domingo)
        // Linux: "America/Santo_Domingo"
        // Generic: "Atlantic Standard Time"
        var zoneIds = new[] { "SA Western Standard Time", "America/Santo_Domingo", "Atlantic Standard Time" };
        
        foreach (var id in zoneIds)
        {
            try {
                var tz = TimeZoneInfo.FindSystemTimeZoneById(id);
                if (tz != null) return tz;
            } catch { }
        }

        // Fallback to UTC-4 offset if no system timezone is found
        try {
            return TimeZoneInfo.CreateCustomTimeZone("DR_AST", TimeSpan.FromHours(-4), "Dominican AST", "Dominican AST");
        } catch {
            return TimeZoneInfo.Utc; // Absolute fallback
        }
    }

    public static DateTimeOffset CalculateNextRun(BackupSchedule schedule, DateTimeOffset fromUtc)
    {
        if (schedule.UseCron && !string.IsNullOrEmpty(schedule.CronExpression))
        {
            try 
            {
                var cron = CronExpression.Parse(schedule.CronExpression);
                var drTimeZone = GetDominicanTimeZone();

                var nextOffset = cron.GetNextOccurrence(fromUtc, drTimeZone);
                
                if (nextOffset.HasValue)
                {
                    return nextOffset.Value;
                }
            }
            catch
            {
                // Fallback to interval
            }
        }
        
        return fromUtc.AddMinutes(schedule.IntervalMinutes > 0 ? schedule.IntervalMinutes : 1440);
    }

    public static string GetCronFromSchedule(BackupSchedule schedule)
    {
        if (schedule.UseCron && !string.IsNullOrEmpty(schedule.CronExpression))
        {
            return schedule.CronExpression;
        }

        int intervalMinutes = schedule.IntervalMinutes;
        if (intervalMinutes <= 0) return "0 0 31 2 *"; // Never (Feb 31)
        if (intervalMinutes < 60) return $"*/{intervalMinutes} * * * *";
        if (intervalMinutes == 60) return "0 * * * *";
        if (intervalMinutes < 1440) return $"0 */{intervalMinutes / 60} * * *";
        if (intervalMinutes == 1440) return "0 0 * * *"; // Daily
        if (intervalMinutes == 10080) return "0 0 * * 0"; // Weekly
        if (intervalMinutes == 43200) return "0 0 1 * *"; // Monthly
        return "0 0 * * *"; // Default
    }
}
