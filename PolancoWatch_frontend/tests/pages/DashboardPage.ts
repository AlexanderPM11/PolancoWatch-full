import { Page, Locator, expect } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly pageHeader: Locator;
  readonly uptimeDisplay: Locator;
  readonly sidebarConsole: Locator;
  readonly sidebarAlerts: Locator;
  readonly sidebarBackups: Locator;
  readonly sidebarWebMonitors: Locator;
  readonly sidebarProcesses: Locator;
  readonly sidebarProfile: Locator;
  readonly sidebarDoc: Locator;
  readonly terminateSessionBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageHeader = page.locator('h1').first();
    this.uptimeDisplay = page.locator('p').filter({ hasText: /System Uptime/i });
    
    // Botones de la barra lateral
    this.sidebarConsole = page.getByRole('button', { name: 'Console' });
    this.sidebarAlerts = page.getByRole('button', { name: 'Alerts' });
    this.sidebarBackups = page.getByRole('button', { name: 'Backups' });
    this.sidebarWebMonitors = page.getByRole('button', { name: 'Web Monitors' });
    this.sidebarProcesses = page.getByRole('button', { name: 'Processes' });
    this.sidebarProfile = page.getByRole('button', { name: 'Profile' });
    this.sidebarDoc = page.getByRole('button', { name: 'Documentation' });
    this.terminateSessionBtn = page.getByRole('button', { name: 'Terminate Session' });
  }

  async navigateToConsole() {
    await this.sidebarConsole.click();
    await this.page.waitForURL('/');
  }

  async navigateToAlerts() {
    await this.sidebarAlerts.click();
    await this.page.waitForURL('/alerts');
  }

  async navigateToBackups() {
    await this.sidebarBackups.click();
    await this.page.waitForURL('/backups');
  }

  async navigateToWebMonitors() {
    await this.sidebarWebMonitors.click();
    await this.page.waitForURL('/web-monitors');
  }

  async navigateToProcesses() {
    await this.sidebarProcesses.click();
    await this.page.waitForURL('/processes');
  }

  async navigateToProfile() {
    await this.sidebarProfile.click();
    await this.page.waitForURL('/profile');
  }

  async navigateToDocumentation() {
    await this.sidebarDoc.click();
    await this.page.waitForURL('/documentation');
  }

  async terminateSession() {
    await this.terminateSessionBtn.click();
    await this.page.waitForURL('/login');
  }
}
