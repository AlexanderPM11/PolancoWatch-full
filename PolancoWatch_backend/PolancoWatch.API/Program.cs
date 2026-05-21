using PolancoWatch.API.Services;
using PolancoWatch.Infrastructure.Hubs;
using PolancoWatch.API.Hubs;
using PolancoWatch.Application.Interfaces;
using PolancoWatch.Infrastructure.Services;

using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using PolancoWatch.Infrastructure.Data;
using PolancoWatch.Domain.Entities;
using Docker.DotNet;
using System.Runtime.InteropServices;

using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);
var enableSwagger = builder.Configuration.GetValue<bool>("ENABLE_SWAGGER");

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
if (!builder.Environment.IsProduction() || enableSwagger)
{
    builder.Services.AddSwaggerGen();
}

// Configure DB Context
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

// Configure Custom Services
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddSingleton<IMetricsCollector, SystemMetricsCollector>();
builder.Services.AddSingleton<IMetricsBroadcaster, SignalRMetricsBroadcaster>();
builder.Services.AddHttpClient<TelegramAlertNotifier>();
builder.Services.AddSingleton<IAlertNotifier, SignalRAlertNotifier>();
builder.Services.AddSingleton<IAlertNotifier, ConsoleAlertNotifier>();
builder.Services.AddSingleton<IAlertNotifier, TelegramAlertNotifier>();
builder.Services.AddSingleton<IAlertNotifier, EmailAlertNotifier>();
builder.Services.AddSingleton<AlertEvaluatorHostedService>();
builder.Services.AddHostedService(provider => provider.GetRequiredService<AlertEvaluatorHostedService>());
builder.Services.AddHostedService<SystemMetricsHostedService>();
builder.Services.AddHostedService<MetricPersistenceHostedService>();
builder.Services.AddHostedService<WebMonitorHostedService>();
builder.Services.AddHttpClient();
builder.Services.AddSingleton<IEmailService, EmailService>();
builder.Services.AddSingleton<ITelegramService, TelegramService>();
builder.Services.AddSingleton<IBackupService, BackupService>();
builder.Services.AddSingleton<IGoogleDriveService, GoogleDriveService>();
builder.Services.AddSingleton<BackupManager>();
builder.Services.AddHostedService<BackupSchedulerHostedService>();
builder.Services.AddSignalR();


// Configure Docker Client (Singleton)
builder.Services.AddSingleton<IDockerClient>(sp => {
    var dockerUri = RuntimeInformation.IsOSPlatform(OSPlatform.Windows) 
        ? "npipe://./pipe/docker_engine" 
        : "unix:///var/run/docker.sock";
    return new DockerClientConfiguration(new Uri(dockerUri)).CreateClient();
});
// Configure JWT Authentication
var jwtKey = Environment.GetEnvironmentVariable("JWT_KEY") 
          ?? Environment.GetEnvironmentVariable("JWT_SECRET") 
          ?? builder.Configuration["Jwt:Key"];

if (builder.Environment.IsProduction())
{
    if (string.IsNullOrEmpty(jwtKey))
    {
        throw new InvalidOperationException("Critical configuration 'Jwt:Key' is missing in production environment.");
    }
    if (string.IsNullOrEmpty(builder.Configuration["Jwt:Issuer"]))
    {
        throw new InvalidOperationException("Critical configuration 'Jwt:Issuer' is missing in production environment.");
    }
    if (string.IsNullOrEmpty(builder.Configuration["Jwt:Audience"]))
    {
        throw new InvalidOperationException("Critical configuration 'Jwt:Audience' is missing in production environment.");
    }

    // VULN-15: Validate Google Drive secrets at startup in production
    var gDriveClientId = Environment.GetEnvironmentVariable("GOOGLE_DRIVE_CLIENT_ID")
                      ?? builder.Configuration["GoogleDrive:ClientId"];
    var gDriveClientSecret = Environment.GetEnvironmentVariable("GOOGLE_DRIVE_CLIENT_SECRET")
                          ?? builder.Configuration["GoogleDrive:ClientSecret"];
    if (string.IsNullOrEmpty(gDriveClientId) || string.IsNullOrEmpty(gDriveClientSecret))
    {
        // Non-fatal warning: Drive is optional, but log it prominently
        Console.WriteLine("[WARN] Google Drive credentials (GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET) are not configured. Cloud sync will be unavailable.");
    }
}
else
{
    jwtKey ??= "super_secret_key_change_me_in_production_so_its_secure_enough_for_sha256";
}

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = builder.Environment.IsProduction();
        options.SaveToken = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.ASCII.GetBytes(jwtKey)),
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"],
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
    });

// Allow CORS for frontend
builder.Services.AddCors(options =>
{
    var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
    var appUrl = Environment.GetEnvironmentVariable("APP_URL") ?? builder.Configuration["APP_URL"];

    options.AddPolicy("AllowAll",
        b => b.WithOrigins(allowedOrigins ?? new[] { appUrl ?? "http://localhost:5173" })
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials());
});

// Configure Rate Limiting
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddFixedWindowLimiter("AuthLimitPolicy", opt =>
    {
        opt.PermitLimit = 5;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueLimit = 0;
    });
});

var app = builder.Build();

// Ensure Data Directory exists for SQLite
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (connectionString != null && connectionString.Contains("Data Source="))
{
    var dbPath = connectionString.Replace("Data Source=", "");
    var directory = Path.GetDirectoryName(dbPath);
    if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
    {
        Directory.CreateDirectory(directory);
    }
}

// Seed Database
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    context.Database.Migrate(); // Ensures migrations are applied

    if (!context.Users.Any())
    {
        string? defaultPassword = Environment.GetEnvironmentVariable("ADMIN_INITIAL_PASSWORD");
        if (string.IsNullOrEmpty(defaultPassword))
        {
            defaultPassword = Guid.NewGuid().ToString("N").Substring(0, 16);
            Console.WriteLine("==================================================");
            Console.WriteLine($"ADMIN USER CREATED. Initial Password: {defaultPassword}");
            Console.WriteLine("Please change this password after your first login.");
            Console.WriteLine("==================================================");
        }

        context.Users.Add(new User
        {
            Username = "admin",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(defaultPassword),
            Email = "admin@example.com", // Default email for reset
            IsAdmin = true
        });
        
        // Seed default Alert Rules
        if (!context.AlertRules.Any())
        {
            context.AlertRules.AddRange(new List<AlertRule>
            {
                new AlertRule { MetricType = MetricType.Cpu, Threshold = 80, IsActive = true },
                new AlertRule { MetricType = MetricType.Memory, Threshold = 85, IsActive = true },
                new AlertRule { MetricType = MetricType.Disk, Threshold = 90, IsActive = true }
            });
        }
        
        // Seed initial Web Monitor
        if (!context.WebMonitors.Any())
        {
            context.WebMonitors.Add(new WebMonitor 
            { 
                Name = "Google Search", 
                Url = "https://www.google.com", 
                CheckIntervalSeconds = 60 
            });
        }
        
        
        // Seed default Notification Settings
        if (!context.NotificationSettings.Any())
        {
            context.NotificationSettings.Add(new NotificationSettings());
        }
        
        context.SaveChanges();
    }
}

// Configure the HTTP request pipeline.
// VULN-07: Restrict ForwardedHeaders to known proxies only to prevent IP spoofing
var forwardedHeadersOptions = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
};
// In production, restrict to only the reverse proxy IP ranges
// KnownNetworks / KnownProxies are empty by default when explicitly set, so wildcards are disabled
if (app.Environment.IsProduction())
{
    // Accept X-Forwarded-For only from localhost reverse proxy (e.g. Nginx/Traefik in Docker network)
    forwardedHeadersOptions.KnownNetworks.Clear();
    forwardedHeadersOptions.KnownProxies.Clear();
    var proxyNetworkCidr = Environment.GetEnvironmentVariable("TRUSTED_PROXY_NETWORK") ?? "172.0.0.0/8";
    var cidrParts = proxyNetworkCidr.Split('/');
    if (cidrParts.Length == 2 && System.Net.IPAddress.TryParse(cidrParts[0], out var proxyIp) && int.TryParse(cidrParts[1], out var prefixLength))
    {
        forwardedHeadersOptions.KnownNetworks.Add(new Microsoft.AspNetCore.HttpOverrides.IPNetwork(proxyIp, prefixLength));
    }
}
app.UseForwardedHeaders(forwardedHeadersOptions);

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

// Global Security Headers
app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    context.Response.Headers.Append("X-XSS-Protection", "1; mode=block");
    context.Response.Headers.Append("Referrer-Policy", "no-referrer");
    context.Response.Headers.Append("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none';");
    await next();
});

if (!app.Environment.IsProduction() || enableSwagger)
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseRouting();
app.UseCors("AllowAll");
app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsProduction() && !enableSwagger)
{
    app.MapGet("/", () => Results.Ok(new
    {
        name = "PolancoWatch API",
        status = "running",
        environment = "Production"
    }));
}
else
{
    app.MapGet("/", () => Results.Redirect("/swagger"));
}

app.MapControllers();
app.MapHub<MetricsHub>("/metricshub");
app.MapHub<LogsHub>("/logshub");
app.MapHub<BackupHub>("/backuphub");


app.Run();
