using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using PolancoWatch.Application.DTOs;
using PolancoWatch.Application.Interfaces;

namespace PolancoWatch.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [EnableRateLimiting("AuthLimitPolicy")]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var response = await _authService.AuthenticateAsync(request);
        if (response == null) return Unauthorized(new { message = "Invalid username or password" });

        return Ok(response);
    }

    [Authorize]
    [HttpPost("profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var username = User.Identity?.Name;
        if (string.IsNullOrEmpty(username)) return Unauthorized();

        var result = await _authService.UpdateProfileAsync(username, request);
        if (!result.Success) return BadRequest(new { message = result.Message });

        return Ok(new { 
            message = result.Message,
            token = result.NewToken,
            username = request.NewUsername ?? username
        });
    }

    [EnableRateLimiting("AuthLimitPolicy")]
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        var result = await _authService.ForgotPasswordAsync(request);
        return Ok(new { success = result.Success, message = result.Message });
    }

    [EnableRateLimiting("AuthLimitPolicy")]
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        var result = await _authService.ResetPasswordAsync(request);
        if (!result.Success) return BadRequest(new { message = result.Message });

        return Ok(new { message = result.Message });
    }
}
