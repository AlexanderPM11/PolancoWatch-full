using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PolancoWatch.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPerformanceIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_WebChecks_WebMonitorId_Timestamp",
                table: "WebChecks",
                columns: new[] { "WebMonitorId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_HistoricalMetrics_Timestamp",
                table: "HistoricalMetrics",
                column: "Timestamp");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_WebChecks_WebMonitorId_Timestamp",
                table: "WebChecks");

            migrationBuilder.DropIndex(
                name: "IX_HistoricalMetrics_Timestamp",
                table: "HistoricalMetrics");
        }
    }
}
