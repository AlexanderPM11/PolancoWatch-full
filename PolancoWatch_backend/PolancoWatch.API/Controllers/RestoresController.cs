using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PolancoWatch.Domain.Entities;
using PolancoWatch.Infrastructure.Data;
using Hangfire;
using PolancoWatch.Infrastructure.Services;
using Microsoft.AspNetCore.Http.Features;

namespace PolancoWatch.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RestoresController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IBackgroundJobClient _backgroundJobs;
    private readonly string _restoreRootPath;

    public RestoresController(ApplicationDbContext context, IBackgroundJobClient backgroundJobs)
    {
        _context = context;
        _backgroundJobs = backgroundJobs;
        _restoreRootPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "backups", "restores");
        if (!Directory.Exists(_restoreRootPath))
        {
            Directory.CreateDirectory(_restoreRootPath);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetRestores()
    {
        var restores = await _context.Restores
            .OrderByDescending(r => r.CreatedAt)
            .Take(50)
            .ToListAsync();
        return Ok(restores);
    }

    [HttpPost("upload")]
    [DisableRequestSizeLimit]
    [RequestFormLimits(MultipartBodyLengthLimit = long.MaxValue)]
    public async Task<IActionResult> UploadRestoreFile([FromForm] IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("File is empty or missing.");

        string fileName = $"{Guid.NewGuid()}_{file.FileName}";
        string filePath = Path.Combine(_restoreRootPath, fileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        return Ok(new { FilePath = filePath });
    }

    [HttpPost("execute")]
    public async Task<IActionResult> ExecuteRestore([FromBody] ExecuteRestoreDto request)
    {
        if (string.IsNullOrEmpty(request.TargetContainer) || string.IsNullOrEmpty(request.FilePath))
        {
            return BadRequest("Target container and file path are required.");
        }

        if (!System.IO.File.Exists(request.FilePath))
        {
            return BadRequest("The uploaded file could not be found. Please upload again.");
        }

        var restore = new Restore
        {
            Name = request.Name ?? $"Restore_{DateTime.Now:yyyyMMddHHmmss}",
            Type = request.Type,
            TargetContainer = request.TargetContainer,
            FilePath = request.FilePath,
            Status = RestoreStatus.Pending
        };

        _context.Restores.Add(restore);
        await _context.SaveChangesAsync();

        _backgroundJobs.Enqueue<RestoreManager>(m => m.RunRestoreAsync(restore.Id));

        return Ok(restore);
    }
}

public class ExecuteRestoreDto
{
    public string? Name { get; set; }
    public RestoreType Type { get; set; }
    public string TargetContainer { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
}
