import { Page, Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorAlert: Locator;

  constructor(page: Page) {
    this.page = page;
    // Selectores semánticos y de accesibilidad adaptados al diseño Cyberpunk/Glassmorphism de PolancoWatch
    this.usernameInput = page.getByPlaceholder('ADMIN_USER');
    this.passwordInput = page.getByPlaceholder('••••••••');
    this.submitButton = page.getByRole('button', { name: /INITIALIZE_SESSION/i });
    this.errorAlert = page.locator('form div').filter({ hasText: /INVALID|REQUIRED|ERROR/i }).first();
  }

  async navigate() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectErrorMessage(message: string) {
    await expect(this.errorAlert).toBeVisible();
    await expect(this.errorAlert).toContainText(message);
  }
}
