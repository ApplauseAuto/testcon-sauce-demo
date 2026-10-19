import type { Page } from '@playwright/test';
import { type VisualLocator, visual } from '../visual-locator/visual-locator';

export class BasePage {
  protected readonly v: VisualLocator;

  constructor(protected readonly page: Page) {
    this.v = visual(page, { timeout: 10_000 });
  }

  async open(): Promise<void> {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
  }
}
