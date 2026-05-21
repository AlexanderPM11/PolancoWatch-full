using System.Threading.Tasks;

namespace PolancoWatch.Application.Interfaces;

public interface IGoogleDriveService
{
    Task<(string fileId, string webViewLink)> UploadFileAsync(string filePath, string fileName, string username, string? folderId = null);
    Task<System.Collections.Generic.List<(string id, string name, DateTime? createdTime)>> ListFilesAsync(string folderId, string username);
    Task<string> GetOrCreateFolderAsync(string folderName, string username, string? parentId = null);
    Task<bool> DeleteFileAsync(string fileId, string username);
    Task<bool> IsAuthenticatedAsync(string username);
    string GetAuthUrl(string redirectUri, string state);
    Task<string> ExchangeCodeForRefreshTokenAsync(string code, string redirectUri, string username);
    Task RevokeAuthAsync(string username);
}
