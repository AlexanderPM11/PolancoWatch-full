using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using PolancoWatch.Application.DTOs;
using PolancoWatch.Application.Interfaces;
using PolancoWatch.Infrastructure.Data;
using PolancoWatch.Domain.Entities;
using PolancoWatch.Domain.Common;

namespace PolancoWatch.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly IEmailService _emailService;
    private readonly ITelegramService _telegramService;

    public AuthService(ApplicationDbContext context, IConfiguration configuration, IEmailService emailService, ITelegramService telegramService)
    {
        _context = context;
        _configuration = configuration;
        _emailService = emailService;
        _telegramService = telegramService;
    }

    public async Task<AuthResponse?> AuthenticateAsync(LoginRequest request)
    {
        var user = await _context.Users.SingleOrDefaultAsync(u => u.Username == request.Username);
        if (user == null) return null;

        bool verified = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
        if (!verified) return null;

        var token = GenerateToken(user);
        return new AuthResponse
        {
            Token = token,
            Username = user.Username
        };
    }

    public async Task<(bool Success, string Message, string? NewToken)> UpdateProfileAsync(string currentUsername, UpdateProfileRequest request)
    {
        var user = await _context.Users.SingleOrDefaultAsync(u => u.Username == currentUsername);
        if (user == null) return (false, "User not found.", null);

        bool verified = BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash);
        if (!verified) return (false, "Incorrect current password.", null);

        bool usernameChanged = false;
        if (!string.IsNullOrWhiteSpace(request.NewUsername) && request.NewUsername != currentUsername)
        {
            var existingUser = await _context.Users.AnyAsync(u => u.Username == request.NewUsername);
            if (existingUser) return (false, "Username already taken.", null);
            
            user.Username = request.NewUsername;
            usernameChanged = true;
        }

        if (!string.IsNullOrWhiteSpace(request.NewPassword))
        {
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        }

        await _context.SaveChangesAsync();

        string? newToken = usernameChanged ? GenerateToken(user) : null;
        return (true, "Profile updated successfully.", newToken);
    }

    public async Task<(bool Success, string Message)> ForgotPasswordAsync(ForgotPasswordRequest request)
    {
        var user = await _context.Users.SingleOrDefaultAsync(u => 
            (!string.IsNullOrEmpty(request.Email) && u.Email == request.Email) ||
            (!string.IsNullOrEmpty(request.Username) && u.Username == request.Username));

        var settings = await _context.NotificationSettings.FirstOrDefaultAsync();
        bool isTelegramConfigured = settings != null && settings.TelegramEnabled &&
                                  !string.IsNullOrWhiteSpace(settings.TelegramBotToken) && 
                                  !string.IsNullOrWhiteSpace(settings.TelegramChatId);
        
        bool isEmailConfigured = settings != null && settings.EmailEnabled &&
                                !string.IsNullOrWhiteSpace(settings.SmtpHost);

        if (!isTelegramConfigured && !isEmailConfigured)
        {
            return (false, "ERROR_NOTIFICATIONS_NOT_CONFIGURED: NEITHER TELEGRAM NOR EMAIL CHANNELS ARE ACTIVE.");
        }

        if (user == null) return (true, "Recovery protocol initiated. If your identity matches our records, a link will be dispatched."); 

        // Check 5-minute cooldown
        if (user.LastResetRequest.HasValue && (TimeHelper.Now - user.LastResetRequest.Value).TotalMinutes < 5)
        {
            var remainingMinutes = 5 - (int)(TimeHelper.Now - user.LastResetRequest.Value).TotalMinutes;
            return (false, $"ERROR_COOLDOWN_ACTIVE: PLEASE WAIT {remainingMinutes} MINUTES BEFORE REQUESTING ANOTHER RESET.");
        }

        // VULN-10: Use CSPRNG (Cryptographically Secure Pseudo-Random Number Generator)
        // instead of Guid.NewGuid() which does not guarantee full CSPRNG usage.
        var tokenBytes = new byte[32];
        System.Security.Cryptography.RandomNumberGenerator.Fill(tokenBytes);
        var token = Convert.ToBase64String(tokenBytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_'); // URL-safe Base64
        user.ResetToken = token;
        user.ResetTokenExpiry = TimeHelper.Now.AddHours(1);
        user.LastResetRequest = TimeHelper.Now;
        await _context.SaveChangesAsync();

        var appUrl = Environment.GetEnvironmentVariable("APP_URL") ?? 
                     _configuration["APP_URL"] ?? 
                     "http://localhost:5173";
        var resetLink = $"{appUrl}/reset-password?token={token}";
        
        var sentTo = new List<string>();
        
        if (isTelegramConfigured)
        {
            var telegramMsg = $@"*PolancoWatch Recovery Protocol*

*Application:* PolancoWatch
A password reset has been requested for the user: *{user.Username}*

Click the link below to set a new security key:
{resetLink}

_If you didn't request this, you can ignore this message._";
            await _telegramService.SendMessageAsync(telegramMsg, settings);
            sentTo.Add("Telegram");
        }

        if (isEmailConfigured && !string.IsNullOrEmpty(user.Email))
        {
            var emailBody = $@"
                <h2>PolancoWatch Recovery Protocol</h2>
                <p>A password reset has been requested for the user: <strong>{user.Username}</strong></p>
                <p>Click the link below to set a new security key:</p>
                <p><a href='{resetLink}'>{resetLink}</a></p>
                <br/>
                <p><em>If you didn't request this, you can ignore this email.</em></p>";
            
            await _emailService.SendEmailAsync(user.Email, "PolancoWatch - Password Recovery Request", emailBody, settings);
            sentTo.Add("Email");
        }

        if (sentTo.Count == 0)
        {
            return (false, "ERROR_NO_VALID_DESTINATION: TELEGRAM IS NOT CONFIGURED AND USER HAS NO EMAIL REGISTERED.");
        }

        return (true, $"Recovery protocol initiated. Check your {string.Join(" and ", sentTo)}.");
    }

    public async Task<(bool Success, string Message)> ResetPasswordAsync(ResetPasswordRequest request)
    {
        // First fetch the user by token. This avoids complex SQL date translations that can fail on SQLite
        var user = await _context.Users.FirstOrDefaultAsync(u => u.ResetToken == request.Token);
        
        if (user == null) 
            return (false, "Invalid or unrecognized recovery token.");

        if (!user.ResetTokenExpiry.HasValue || user.ResetTokenExpiry.Value < TimeHelper.Now)
            return (false, "Recovery link has expired. Please request a new one.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.ResetToken = null;
        user.ResetTokenExpiry = null;
        await _context.SaveChangesAsync();

        return (true, "Password secured successfully.");
    }

    private string GenerateToken(User user)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var jwtKey = Environment.GetEnvironmentVariable("JWT_KEY") 
                  ?? Environment.GetEnvironmentVariable("JWT_SECRET") 
                  ?? _configuration["Jwt:Key"] 
                  ?? "super_secret_key_change_me_in_production_so_its_secure_enough_for_sha256";
        var key = Encoding.ASCII.GetBytes(jwtKey);
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Role, user.IsAdmin ? "Admin" : "User")
            }),
            Expires = DateTime.UtcNow.AddHours(8), // VULN-04: Reduced from 7 days to 8 hours to limit token compromise window
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature),
            Issuer = _configuration["Jwt:Issuer"],
            Audience = _configuration["Jwt:Audience"]
        };
        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }
}
