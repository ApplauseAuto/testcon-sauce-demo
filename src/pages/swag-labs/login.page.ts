import { type Locator, type Page } from '@playwright/test';
import { BasePage } from '@/pages/base.page';

export class LoginPage extends BasePage {
  constructor(protected readonly page: Page) {
    super(page);
  }

  get usernameInput(): Locator {
    return this.page.locator('role=textbox[name="Username"]').or(this.page.locator('input[name=\'user-name\']')).or(this.page.locator('#user-name')).or(this.page.locator('textbox >> nth=0'));
  }

  get passwordInput(): Locator {
    return this.page.locator('role=textbox[name="Password"]').or(this.page.locator('input[name=\'password\']')).or(this.page.locator('#password')).or(this.page.locator('textbox >> nth=1'));
  }

  get loginElement(): Locator {
    return this.page.locator('role=button[name="Login"]').or(this.page.locator('input[type=\'submit\']')).or(this.page.locator('#login-button')).or(this.page.locator('button:has-text(\'Login\')'));
  }

  /** Typing the username into the Username field. */
  async fillUsername(value: string): Promise<void> {
    await this.usernameInput.fill(value);
  }

  /** Typing the password into the Password field. */
  async fillPassword(value: string): Promise<void> {
    await this.passwordInput.fill(value);
  }

  /** Clicking the Login button to submit credentials. */
  async clickLogin(): Promise<void> {
    await this.loginElement.click();
  }
}
