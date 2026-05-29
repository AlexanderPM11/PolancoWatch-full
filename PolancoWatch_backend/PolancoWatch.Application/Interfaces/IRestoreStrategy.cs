using System.Threading.Tasks;
using PolancoWatch.Domain.Entities;

namespace PolancoWatch.Application.Interfaces;

public interface IRestoreStrategy
{
    bool CanHandle(RestoreType type);
    Task ExecuteRestoreAsync(RestoreContext context);
}

public class RestoreContext
{
    public RestoreType Type { get; set; }
    public string TargetContainer { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public string RestoreName { get; set; } = string.Empty;
    public string? DbName { get; set; }
    public string DbUser { get; set; } = "root";
    public string? DbPass { get; set; }
}
