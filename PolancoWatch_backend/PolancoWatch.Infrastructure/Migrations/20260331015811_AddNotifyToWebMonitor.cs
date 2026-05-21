using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PolancoWatch.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddNotifyToWebMonitor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "Notify",
                table: "WebMonitors",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Notify",
                table: "WebMonitors");
        }
    }
}
