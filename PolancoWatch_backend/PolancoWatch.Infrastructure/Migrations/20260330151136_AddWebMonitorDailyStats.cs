using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PolancoWatch.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddWebMonitorDailyStats : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "WebMonitorDailyStats",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    WebMonitorId = table.Column<int>(type: "INTEGER", nullable: false),
                    Date = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpPercentage = table.Column<double>(type: "REAL", nullable: false),
                    DownPercentage = table.Column<double>(type: "REAL", nullable: false),
                    SlowPercentage = table.Column<double>(type: "REAL", nullable: false),
                    AverageLatencyMs = table.Column<double>(type: "REAL", nullable: false),
                    TotalChecks = table.Column<int>(type: "INTEGER", nullable: false),
                    UpCount = table.Column<int>(type: "INTEGER", nullable: false),
                    DownCount = table.Column<int>(type: "INTEGER", nullable: false),
                    SlowCount = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WebMonitorDailyStats", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WebMonitorDailyStats_WebMonitors_WebMonitorId",
                        column: x => x.WebMonitorId,
                        principalTable: "WebMonitors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WebMonitorDailyStats_WebMonitorId",
                table: "WebMonitorDailyStats",
                column: "WebMonitorId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WebMonitorDailyStats");
        }
    }
}
