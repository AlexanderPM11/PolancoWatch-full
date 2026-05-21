using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PolancoWatch.Infrastructure.Data;
using PolancoWatch.Domain.Entities;
using PolancoWatch.Domain.Common;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace PolancoWatch.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class MetricsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public MetricsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("history")]
    public async Task<ActionResult<IEnumerable<HistoricalMetric>>> GetHistory([FromQuery] int durationHours = 24)
    {
        var cutoff = TimeHelper.Now.AddHours(-durationHours);
        
        var history = await _context.HistoricalMetrics
            .Where(m => m.Timestamp >= cutoff)
            .OrderBy(m => m.Timestamp)
            .ToListAsync();
            
        return Ok(history);
    }
}
