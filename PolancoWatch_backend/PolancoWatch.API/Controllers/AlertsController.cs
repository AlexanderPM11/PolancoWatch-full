using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PolancoWatch.Domain.Entities;
using PolancoWatch.Infrastructure.Data;

namespace PolancoWatch.API.Controllers;

[Authorize(Roles = "Admin")]
[ApiController]
[Route("api/alerts")]
public class AlertsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public AlertsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("rules")]
    public async Task<IActionResult> GetRules()
    {
        var rules = await _context.AlertRules.ToListAsync();
        return Ok(rules);
    }

    [HttpPost("rules")]
    public async Task<IActionResult> UpdateRule([FromBody] AlertRule rule)
    {
        var existing = await _context.AlertRules.FindAsync(rule.Id);
        if (existing == null)
        {
            _context.AlertRules.Add(rule);
        }
        else
        {
            existing.Threshold = rule.Threshold;
            existing.CooldownSeconds = rule.CooldownSeconds;
            existing.IsActive = rule.IsActive;
            _context.AlertRules.Update(existing);
        }

        await _context.SaveChangesAsync();
        return Ok(existing ?? rule);
    }

    [HttpDelete("rules/{id}")]
    public async Task<IActionResult> DeleteRule(int id)
    {
        var rule = await _context.AlertRules.FindAsync(id);
        if (rule == null) return NotFound();

        _context.AlertRules.Remove(rule);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Rule deleted" });
    }

    [HttpGet("history")]
    public async Task<IActionResult> GetHistory()
    {
        var history = await _context.AlertHistories
            .Include(h => h.AlertRule)
            .OrderByDescending(h => h.TriggeredAt)
            .Take(100)
            .ToListAsync();
        
        return Ok(history);
    }
    [HttpDelete("history")]
    public async Task<IActionResult> DeleteHistory()
    {
        var history = await _context.AlertHistories.ToListAsync();
        _context.AlertHistories.RemoveRange(history);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
