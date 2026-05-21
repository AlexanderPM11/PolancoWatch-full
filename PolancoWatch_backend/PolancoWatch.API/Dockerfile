FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80

RUN apt-get update && apt-get install -y procps && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /app/data /app/backups

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["PolancoWatch.API/PolancoWatch.API.csproj", "PolancoWatch.API/"]
COPY ["PolancoWatch.Application/PolancoWatch.Application.csproj", "PolancoWatch.Application/"]
COPY ["PolancoWatch.Domain/PolancoWatch.Domain.csproj", "PolancoWatch.Domain/"]
COPY ["PolancoWatch.Infrastructure/PolancoWatch.Infrastructure.csproj", "PolancoWatch.Infrastructure/"]
RUN dotnet restore "PolancoWatch.API/PolancoWatch.API.csproj"
COPY . .
WORKDIR "/src/PolancoWatch.API"
RUN dotnet build "PolancoWatch.API.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "PolancoWatch.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "PolancoWatch.API.dll"]
