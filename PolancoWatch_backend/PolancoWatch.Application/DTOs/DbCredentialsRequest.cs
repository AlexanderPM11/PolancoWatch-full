namespace PolancoWatch.Application.DTOs;

/// <summary>
/// DTO for passing database credentials securely via request body
/// instead of query string parameters to avoid credential logging.
/// </summary>
public class DbCredentialsRequest
{
    public string User { get; set; } = "root";
    public string? Pass { get; set; }
}
