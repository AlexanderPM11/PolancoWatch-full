using System;
using System.ComponentModel.DataAnnotations;
using PolancoWatch.Domain.Common;

namespace PolancoWatch.Domain.Entities;

public class User
{
    public int Id { get; set; }
    [MaxLength(100)]
    public string Username { get; set; } = string.Empty;
    [MaxLength(256)]
    public string PasswordHash { get; set; } = string.Empty;
    [MaxLength(256)]
    public string Email { get; set; } = string.Empty;
    [MaxLength(512)]
    public string? ResetToken { get; set; }
    public DateTimeOffset? ResetTokenExpiry { get; set; }
    public DateTimeOffset? LastResetRequest { get; set; }
    public bool IsAdmin { get; set; }
}
