using System;

namespace PolancoWatch.Domain.Common;

public static class TimeHelper
{
    // Dominican Republic is always UTC-4 (Atlantic Standard Time)
    // No Daylight Saving Time
    private const int DR_OFFSET = -4;

    public static DateTimeOffset Now => DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(DR_OFFSET));
}
