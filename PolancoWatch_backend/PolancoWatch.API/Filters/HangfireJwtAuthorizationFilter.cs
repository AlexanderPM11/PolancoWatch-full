using Hangfire.Dashboard;
using Microsoft.AspNetCore.Http;
using System.Linq;

namespace PolancoWatch.API.Filters;

public class HangfireJwtAuthorizationFilter : IDashboardAuthorizationFilter
{
    public bool Authorize(DashboardContext context)
    {
        var httpContext = context.GetHttpContext();

        // The JwtBearer middleware will automatically populate User.Identity.IsAuthenticated
        // if a valid "jwt" cookie or Authorization header was provided.
        if (httpContext.User.Identity?.IsAuthenticated == true)
        {
            // You can optionally check for Admin roles/claims here
            // e.g., return httpContext.User.IsInRole("Admin");
            return true;
        }

        return false;
    }
}
