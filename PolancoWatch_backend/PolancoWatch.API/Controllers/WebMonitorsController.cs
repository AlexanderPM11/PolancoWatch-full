using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PolancoWatch.Domain.Entities;
using PolancoWatch.Infrastructure.Data;

namespace PolancoWatch.API.Controllers;

[Authorize(Roles = "Admin")]
[ApiController]
[Route("api/[controller]")]
public class WebMonitorsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public WebMonitorsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<WebMonitor>>> GetMonitors()
    {
        return await _context.WebMonitors
            .OrderBy(m => m.Name)
            .ToListAsync();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<WebMonitor>> GetMonitor(int id)
    {
        var monitor = await _context.WebMonitors.FindAsync(id);
        if (monitor == null) return NotFound();
        return monitor;
    }

    [HttpGet("{id}/history")]
    public async Task<ActionResult<IEnumerable<WebCheck>>> GetHistory(int id, [FromQuery] int limit = 50)
    {
        return await _context.WebChecks
            .Where(c => c.WebMonitorId == id)
            .OrderByDescending(c => c.Timestamp)
            .Take(limit)
            .ToListAsync();
    }

    [HttpGet("{id}/stats")]
    public async Task<ActionResult<IEnumerable<WebMonitorDailyStats>>> GetStats(int id, [FromQuery] int days = 15)
    {
        return await _context.WebMonitorDailyStats
            .Where(s => s.WebMonitorId == id)
            .OrderByDescending(s => s.Date)
            .Take(days)
            .ToListAsync();
    }

    [HttpPost]
    public async Task<ActionResult<WebMonitor>> CreateMonitor(WebMonitor monitor)
    {
        _context.WebMonitors.Add(monitor);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetMonitor), new { id = monitor.Id }, monitor);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateMonitor(int id, WebMonitor monitor)
    {
        if (id != monitor.Id) return BadRequest();

        var existing = await _context.WebMonitors.FindAsync(id);
        if (existing == null) return NotFound();

        existing.Name = monitor.Name;
        existing.Url = monitor.Url;
        existing.CheckIntervalSeconds = monitor.CheckIntervalSeconds;
        existing.IsActive = monitor.IsActive;
        existing.SlowThresholdMs = monitor.SlowThresholdMs;
        existing.NotifyOnSlow = monitor.NotifyOnSlow;
        existing.Notify = monitor.Notify;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteMonitor(int id)
    {
        var monitor = await _context.WebMonitors.FindAsync(id);
        if (monitor == null) return NotFound();

        _context.WebMonitors.Remove(monitor);
        // Cascading delete for checks if configured, otherwise manual
        var checks = await _context.WebChecks.Where(c => c.WebMonitorId == id).ToListAsync();
        _context.WebChecks.RemoveRange(checks);

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id}/toggle")]
    public async Task<IActionResult> ToggleMonitor(int id)
    {
        var monitor = await _context.WebMonitors.FindAsync(id);
        if (monitor == null) return NotFound();

        monitor.IsActive = !monitor.IsActive;
        await _context.SaveChangesAsync();
        return Ok(new { monitor.IsActive });
    }

    [HttpPost("{id}/toggle-notify")]
    public async Task<IActionResult> ToggleNotify(int id)
    {
        var monitor = await _context.WebMonitors.FindAsync(id);
        if (monitor == null) return NotFound();

        monitor.Notify = !monitor.Notify;
        await _context.SaveChangesAsync();
        return Ok(new { monitor.Notify });
    }
}
