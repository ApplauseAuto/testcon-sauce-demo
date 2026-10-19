import { type Locator, type Page } from '@playwright/test';
import { BasePage } from '@/pages/base.page';

export class LoginPage extends BasePage {
  constructor(protected readonly page: Page) {
    super(page);
  }

  get usernameInput(): Locator {
    return this.page.locator('role=textbox[name="Username"]').or(this.page.locator('input[type=\'text\']')).or(this.page.locator('form input:nth-of-type(1)'));
  }

  get passwordInput(): Locator {
    return this.page.locator('role=textbox[name="Password"]').or(this.page.locator('input[type=\'password\']')).or(this.page.locator('form input:nth-of-type(2)'));
  }

  get loginElement(): Locator {
    return this.page.locator('role=button[name="Login"]').or(this.page.locator('button:has-text(\'Login\')')).or(this.page.locator('form button'));
  }

  get usernameInput2(): Locator {
    return this.page.locator('input[data-test=\'username\']').or(this.page.locator('#user-name')).or(this.page.locator('input[placeholder=\'Username\']')).or(this.page.locator('role=textbox[name="Username"]')).or(this.page.locator('input[name=\'user-name\']')).or(this.page.locator('[data-test=\'username\']'));
  }

  get passwordInput2(): Locator {
    return this.page.locator('input[data-test=\'password\']').or(this.page.locator('#password')).or(this.page.locator('input[placeholder=\'Password\']')).or(this.page.locator('role=textbox[name="Password"]')).or(this.page.locator('input[name=\'password\']')).or(this.page.locator('[data-test=\'password\']'));
  }

  get loginInput(): Locator {
    return this.page.locator('input[data-test=\'login-button\']').or(this.page.locator('#login-button')).or(this.page.locator('button:has-text(\'Login\')')).or(this.page.locator('role=button[name="Login"]')).or(this.page.locator('[data-test=\'login-button\']'));
  }

  /** Typing the standard_user username into the Username field. */
  async fillUsername(value: string): Promise<void> {
    await this.usernameInput.fill(value);
  }

  /** Typing the secret_sauce password into the Password field. */
  async fillPassword(value: string): Promise<void> {
    await this.passwordInput.fill(value);
  }

  /** Clicking the Login button to submit the login form. */
  async clickLogin(): Promise<void> {
    await this.loginElement.click();
  }

  /** Typing the username into the Username field to begin login. */
  async fillUsername2(value: string): Promise<void> {
    await this.usernameInput2.fill(value);
  }

  /** Typing the password into the Password field. */
  async fillPassword2(value: string): Promise<void> {
    await this.passwordInput2.fill(value);
  }

  /** Clicking the Login button to submit the credentials. */
  async clickLogin2(): Promise<void> {
    await this.loginInput.click();
  }
}
