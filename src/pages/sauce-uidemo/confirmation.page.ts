import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from '@/pages/base.page';

export class ConfirmationPage extends BasePage {
  constructor(protected readonly page: Page) {
    super(page);
  }

  get mainHeading(): Locator {
    return this.page.locator('heading').or(this.page.locator('h2')).or(this.page.locator('main'));
  }

  /** Verifying the confirmation heading confirms the order completed successfully. */
  async expectConfirmationMessage(): Promise<void> {
    await expect(this.mainHeading).toContainText("Thank you for your order!");
  }
}
