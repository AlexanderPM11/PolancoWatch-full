using PolancoWatch.Domain.Entities;
using System.Threading.Tasks;

namespace PolancoWatch.Application.Interfaces;

public interface IEmailService
{
    Task SendEmailAsync(string to, string subject, string body, NotificationSettings? settings = null);
}
