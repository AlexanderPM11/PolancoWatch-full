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
}
