using System;
using System.Collections.Generic;
using System.Linq;
using PolancoWatch.Application.Interfaces;
using PolancoWatch.Domain.Entities;

namespace PolancoWatch.Infrastructure.Services;

public class RestoreStrategyFactory
{
    private readonly IEnumerable<IRestoreStrategy> _strategies;

    public RestoreStrategyFactory(IEnumerable<IRestoreStrategy> strategies)
    {
        _strategies = strategies;
    }

    public IRestoreStrategy GetStrategy(RestoreType type)
    {
        var strategy = _strategies.FirstOrDefault(s => s.CanHandle(type));
        if (strategy == null)
        {
            throw new NotSupportedException($"No restore strategy found for type: {type}");
        }
        return strategy;
    }
}
