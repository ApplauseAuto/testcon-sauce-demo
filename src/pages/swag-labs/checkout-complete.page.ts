import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from '@/pages/base.page';

export class CheckoutCompletePage extends BasePage {
  constructor(protected readonly page: Page) {
    super(page);
  }

  get thankYouForYourHeading(): Locator {
    return this.page.locator('heading').or(this.page.locator('text=Thank you for your order!')).or(this.page.locator('h2'));
  }

  /** Verifying the order confirmation heading reads Thank you for your order to confirm checkout completed successfully. */
  async expectThankYouMessage(): Promise<void> {
    await expect(this.thankYouForYourHeading).toContainText("Thank you for your order!");
  }
}
