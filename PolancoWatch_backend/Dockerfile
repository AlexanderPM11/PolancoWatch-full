# Build Stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy solution and project files
COPY ["PolancoWatch.slnx", "./"]
COPY ["PolancoWatch.API/PolancoWatch.API.csproj", "PolancoWatch.API/"]
COPY ["PolancoWatch.Application/PolancoWatch.Application.csproj", "PolancoWatch.Application/"]
COPY ["PolancoWatch.Domain/PolancoWatch.Domain.csproj", "PolancoWatch.Domain/"]
COPY ["PolancoWatch.Infrastructure/PolancoWatch.Infrastructure.csproj", "PolancoWatch.Infrastructure/"]

# Restore dependencies
RUN dotnet restore "PolancoWatch.API/PolancoWatch.API.csproj"

# Copy everything else and build
COPY . .
WORKDIR "/src/PolancoWatch.API"
RUN dotnet build "PolancoWatch.API.csproj" -c Release -o /app/build

# Publish Stage
FROM build AS publish
RUN dotnet publish "PolancoWatch.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Runtime Stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
EXPOSE 80

# Install procps for process metrics (ps -eo)
RUN apt-get update && apt-get install -y procps && rm -rf /var/lib/apt/lists/*

# Create data and backup directories for SQLite and local backup storage
RUN mkdir -p /app/data /app/backups
# Use a non-root user if possible, but for metrics we might need root.
# For now, ensure the data directory is accessible.

COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "PolancoWatch.API.dll"]
