using System;
using System.Collections.Generic;
using System.Linq;
using PolancoWatch.Application.Interfaces;
using PolancoWatch.Domain.Entities;

namespace PolancoWatch.Infrastructure.Services.BackupStrategies;

public class BackupStrategyFactory
{
    private readonly IEnumerable<IBackupStrategy> _strategies;

    public BackupStrategyFactory(IEnumerable<IBackupStrategy> strategies)
    {
        _strategies = strategies;
    }

    public IBackupStrategy GetStrategy(BackupType type, string targetPath)
    {
        var strategy = _strategies.FirstOrDefault(s => s.CanHandle(type, targetPath));
        if (strategy == null)
        {
            throw new NotSupportedException($"No backup strategy found for Type: {type}, Target: {targetPath}");
        }
        return strategy;
    }
}
