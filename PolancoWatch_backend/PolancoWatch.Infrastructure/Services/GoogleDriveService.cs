using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Google.Apis.Auth.OAuth2;
using Google.Apis.Auth.OAuth2.Flows;
using Google.Apis.Auth.OAuth2.Responses;
using Google.Apis.Drive.v3;
using Google.Apis.Services;
using Google.Apis.Upload;
using System.Collections.Generic;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using PolancoWatch.Application.Interfaces;

namespace PolancoWatch.Infrastructure.Services;

public class GoogleDriveService : IGoogleDriveService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<GoogleDriveService> _logger;
    private readonly string _applicationName = "PolancoWatch";
    private DriveService? _driveService;

    private static readonly string[] Scopes = { DriveService.Scope.Drive };

    public GoogleDriveService(IConfiguration configuration, ILogger<GoogleDriveService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    // --- OAuth 2.0 Flow ---

    private GoogleAuthorizationCodeFlow CreateFlow()
    {
        var clientId = GetFirstConfiguredValue(
            Environment.GetEnvironmentVariable("GOOGLE_DRIVE_CLIENT_ID"),
            _configuration["GoogleDrive:ClientId"]);
        var clientSecret = GetFirstConfiguredValue(
            Environment.GetEnvironmentVariable("GOOGLE_DRIVE_CLIENT_SECRET"),
            _configuration["GoogleDrive:ClientSecret"]);

        if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(clientSecret))
            throw new Exception("Google Drive OAuth credentials not configured. Set GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET.");

        return new GoogleAuthorizationCodeFlow(new GoogleAuthorizationCodeFlow.Initializer
        {
            ClientSecrets = new ClientSecrets
            {
                ClientId = clientId,
                ClientSecret = clientSecret
            },
            Scopes = Scopes
        });
    }

    public string GetAuthUrl(string redirectUri, string state)
    {
        var clientId = GetFirstConfiguredValue(
            Environment.GetEnvironmentVariable("GOOGLE_DRIVE_CLIENT_ID"),
            _configuration["GoogleDrive:ClientId"])
            ?? throw new Exception("GoogleDrive:ClientId / GOOGLE_DRIVE_CLIENT_ID not configured.");

        var encodedRedirect = Uri.EscapeDataString(redirectUri);
        var scope = Uri.EscapeDataString("https://www.googleapis.com/auth/drive");
        var encodedState = Uri.EscapeDataString(state);

        return $"https://accounts.google.com/o/oauth2/v2/auth" +
               $"?client_id={clientId}" +
               $"&redirect_uri={encodedRedirect}" +
               $"&response_type=code" +
               $"&scope={scope}" +
               $"&access_type=offline" +
               $"&state={encodedState}" +
               $"&prompt=consent";
    }

    public async Task<string> ExchangeCodeForRefreshTokenAsync(string code, string redirectUri)
    {
        var flow = CreateFlow();
        var tokenResponse = await flow.ExchangeCodeForTokenAsync("user", code, redirectUri, CancellationToken.None);

        if (string.IsNullOrEmpty(tokenResponse.RefreshToken))
            throw new Exception("No refresh token was returned. Make sure you are not already authorized; try revoking access at https://myaccount.google.com/permissions and try again.");

        // Persist refresh token to a local file so it survives restarts
        var tokenPath = GetTokenFilePath();
        await File.WriteAllTextAsync(tokenPath, tokenResponse.RefreshToken);
        _logger.LogInformation("[DriveService] Refresh token saved to: {TokenPath}", tokenPath);

        // Reset cached service so it re-initializes with new token
        _driveService = null;

        return tokenResponse.RefreshToken;
    }

    // --- Drive Service ---

    private async Task<DriveService> GetDriveServiceAsync()
    {
        if (_driveService != null) return _driveService;

        var clientId = GetFirstConfiguredValue(
            Environment.GetEnvironmentVariable("GOOGLE_DRIVE_CLIENT_ID"),
            _configuration["GoogleDrive:ClientId"]);
        var clientSecret = GetFirstConfiguredValue(
            Environment.GetEnvironmentVariable("GOOGLE_DRIVE_CLIENT_SECRET"),
            _configuration["GoogleDrive:ClientSecret"]);

        if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(clientSecret))
            throw new Exception("Google Drive OAuth credentials not configured. Set GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET.");

        // Load refresh token from file or config
        var refreshToken = await LoadRefreshTokenAsync();
        if (string.IsNullOrEmpty(refreshToken))
            throw new Exception("Google Drive is not authorized. Please click 'Connect Google Drive' to authorize the application.");

        var flow = CreateFlow();
        var tokenResponse = new TokenResponse { RefreshToken = refreshToken };
        var credential = new UserCredential(flow, "user", tokenResponse);

        _driveService = new DriveService(new BaseClientService.Initializer
        {
            HttpClientInitializer = credential,
            ApplicationName = _applicationName,
        });

        return _driveService;
    }

    private async Task<string?> LoadRefreshTokenAsync()
    {
        // 1. Environment variable (for Docker/production)
        var fromEnv = Environment.GetEnvironmentVariable("GOOGLE_DRIVE_REFRESH_TOKEN");
        if (!string.IsNullOrEmpty(fromEnv)) return fromEnv;

        // 2. Config file fallback
        var fromConfig = _configuration["GoogleDrive:RefreshToken"];
        if (!string.IsNullOrEmpty(fromConfig)) return fromConfig;

        // 3. Local token file (written after OAuth callback)
        var tokenPath = GetTokenFilePath();
        if (File.Exists(tokenPath))
            return (await File.ReadAllTextAsync(tokenPath)).Trim();

        return null;
    }

    private string GetTokenFilePath()
    {
        // Try to store in 'data' directory first (where the SQLite DB is)
        var dataDir = Path.Combine(AppContext.BaseDirectory, "data");
        if (!Directory.Exists(dataDir)) Directory.CreateDirectory(dataDir);
        
        return Path.Combine(dataDir, "drive-token.json");
    }

    // --- Upload ---

    public async Task<(string fileId, string webViewLink)> UploadFileAsync(string filePath, string fileName, string? folderId = null)
    {
        var service = await GetDriveServiceAsync();

        // Resolve target folder ID (Parameter -> Env -> Config)
        var targetFolderIdRaw = folderId
            ?? Environment.GetEnvironmentVariable("GOOGLE_DRIVE_DEFAULT_FOLDER_ID")
            ?? _configuration["GoogleDrive:DefaultFolderId"];

        var targetFolderId = ResolveFolderId(targetFolderIdRaw);

        var fileMetadata = new Google.Apis.Drive.v3.Data.File()
        {
            Name = fileName,
            Parents = string.IsNullOrEmpty(targetFolderId) ? null : new[] { targetFolderId }
        };

        _logger.LogInformation("[DriveService] Uploading '{FileName}' to folder: '{FolderId}'", fileName, targetFolderId ?? "ROOT (My Drive)");

        using var stream = new FileStream(filePath, FileMode.Open);
        var request = service.Files.Create(fileMetadata, stream, GetMimeType(filePath));
        request.Fields = "id, webViewLink";

        var uploadProgress = await request.UploadAsync();

        if (uploadProgress.Status == UploadStatus.Failed)
        {
            throw new Exception($"Google Drive upload failed: {uploadProgress.Exception?.Message ?? "Unknown error"}");
        }

        return (request.ResponseBody.Id, request.ResponseBody.WebViewLink);
    }

    public async Task<List<(string id, string name, DateTime? createdTime)>> ListFilesAsync(string folderId)
    {
        var service = await GetDriveServiceAsync();
        var targetFolderId = ResolveFolderId(folderId);
        
        var request = service.Files.List();
        request.Q = $"'{targetFolderId}' in parents and trashed = false";
        request.Fields = "files(id, name, createdTime)";
        request.OrderBy = "createdTime desc";

        var response = await request.ExecuteAsync();
        var files = new List<(string id, string name, DateTime? createdTime)>();
        foreach (var file in response.Files)
        {
            files.Add((file.Id, file.Name, file.CreatedTimeDateTimeOffset?.DateTime));
        }
        return files;
    }

    public async Task<string> GetOrCreateFolderAsync(string folderName, string? parentId = null)
    {
        var service = await GetDriveServiceAsync();
        
        // Search for existing folder
        var query = $"name = '{folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
        if (!string.IsNullOrEmpty(parentId))
        {
            query += $" and '{parentId}' in parents";
        }

        var listRequest = service.Files.List();
        listRequest.Q = query;
        listRequest.Fields = "files(id, name)";
        var result = await listRequest.ExecuteAsync();

        if (result.Files.Count > 0)
        {
            return result.Files[0].Id;
        }

        // Create new folder
        var folderMetadata = new Google.Apis.Drive.v3.Data.File()
        {
            Name = folderName,
            MimeType = "application/vnd.google-apps.folder"
        };

        if (!string.IsNullOrEmpty(parentId))
        {
            folderMetadata.Parents = new List<string> { parentId };
        }

        var createRequest = service.Files.Create(folderMetadata);
        createRequest.Fields = "id";
        var folder = await createRequest.ExecuteAsync();
        
        return folder.Id;
    }

    public async Task<bool> DeleteFileAsync(string fileId)
    {
        var service = await GetDriveServiceAsync();
        try
        {
            await service.Files.Delete(fileId).ExecuteAsync();
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> IsAuthenticatedAsync()
    {
        try
        {
            await GetDriveServiceAsync();
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning("[DriveService] Auth Check Failed: {Message}", ex.Message);
            return false;
        }
    }

    public async Task RevokeAuthAsync()
    {
        var tokenPath = GetTokenFilePath();
        if (File.Exists(tokenPath))
        {
            File.Delete(tokenPath);
        }
        
        // Reset cached service
        _driveService = null;
        
        await Task.CompletedTask;
    }

    private string? ResolveFolderId(string? input)
    {
        if (string.IsNullOrEmpty(input)) return null;

        // Handle Google Drive URL if pasted
        if (input.Contains("drive.google.com"))
        {
            var match = System.Text.RegularExpressions.Regex.Match(input, @"folders\/([a-zA-Z0-9_-]+)");
            if (match.Success) return match.Groups[1].Value;
        }

        return input.Trim();
    }

    private string GetMimeType(string fileName)
    {
        if (fileName.EndsWith(".zip")) return "application/zip";
        if (fileName.EndsWith(".tar.gz")) return "application/gzip";
        return "application/octet-stream";
    }

    private static string? GetFirstConfiguredValue(params string?[] values)
    {
        foreach (var value in values)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value.Trim();
            }
        }

        return null;
    }
}
