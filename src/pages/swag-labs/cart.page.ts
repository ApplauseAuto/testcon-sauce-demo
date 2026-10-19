import { type Locator, type Page } from '@playwright/test';
import { BasePage } from '@/pages/base.page';

export class CartPage extends BasePage {
  constructor(protected readonly page: Page) {
    super(page);
  }

  get checkoutButton(): Locator {
    return this.page.locator('button:has-text(\'Checkout\')').or(this.page.locator('#checkout')).or(this.page.locator('[data-test=\'checkout\']'));
  }

  /** Clicking Checkout button to proceed to the checkout information step. */
  async clickCheckout(): Promise<void> {
    await this.checkoutButton.click();
  }
}
