namespace PolancoWatch.Application.DTOs;

public class RestoreDbRequest
{
    public string TargetContainerId { get; set; } = string.Empty;
    public string DbUser { get; set; } = "root";
    public string DbPass { get; set; } = string.Empty;
    public string DbName { get; set; } = string.Empty;
}
