import { type Locator, type Page } from '@playwright/test';
import { BasePage } from '@/pages/base.page';

export class CheckoutOverviewPage extends BasePage {
  constructor(protected readonly page: Page) {
    super(page);
  }

  get finishButton(): Locator {
    return this.page.locator('button:has-text(\'Finish\')').or(this.page.locator('[data-test=\'finish\']')).or(this.page.locator('#finish'));
  }

  /** Clicking the Finish button to complete the checkout process. */
  async clickFinish(): Promise<void> {
    await this.finishButton.click();
  }
}
