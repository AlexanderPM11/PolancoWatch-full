using System.Threading.Tasks;

namespace PolancoWatch.Application.Interfaces;

public interface IGoogleDriveService
{
    Task<(string fileId, string webViewLink)> UploadFileAsync(string filePath, string fileName, string? folderId = null);
    Task<System.Collections.Generic.List<(string id, string name, DateTime? createdTime)>> ListFilesAsync(string folderId);
    Task<string> GetOrCreateFolderAsync(string folderName, string? parentId = null);
    Task<bool> DeleteFileAsync(string fileId);
    Task<bool> IsAuthenticatedAsync();
    string GetAuthUrl(string redirectUri);
    Task<string> ExchangeCodeForRefreshTokenAsync(string code, string redirectUri);
    Task RevokeAuthAsync();
}
