using PolancoWatch.Application.DTOs;
using System.Threading.Tasks;

namespace PolancoWatch.Application.Interfaces;

public interface IAuthService
{
    Task<AuthResponse?> AuthenticateAsync(LoginRequest request);
    Task<(bool Success, string Message, string? NewToken)> UpdateProfileAsync(string currentUsername, UpdateProfileRequest request);
    Task<(bool Success, string Message)> ForgotPasswordAsync(ForgotPasswordRequest request);
    Task<(bool Success, string Message)> ResetPasswordAsync(ResetPasswordRequest request);
}
