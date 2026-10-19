import { type Locator, type Page } from '@playwright/test';
import { BasePage } from '@/pages/base.page';

export class CheckoutPage extends BasePage {
  constructor(protected readonly page: Page) {
    super(page);
  }

  get firstNameInput(): Locator {
    return this.page.locator('role=textbox[name="First Name"]').or(this.page.locator('input[placeholder=\'First Name\']')).or(this.page.locator('form[action] input >> nth=0'));
  }

  get lastNameInput(): Locator {
    return this.page.locator('role=textbox[name="Last Name"]').or(this.page.locator('input[placeholder=\'Last Name\']')).or(this.page.locator('form[action] input >> nth=1'));
  }

  get zipPostalCodeInput(): Locator {
    return this.page.locator('role=textbox[name="Zip/Postal Code"]').or(this.page.locator('input[placeholder=\'Zip/Postal Code\']')).or(this.page.locator('form[action] input >> nth=2'));
  }

  get continueElement(): Locator {
    return this.page.locator('role=button[name="Continue"]').or(this.page.locator('button:has-text(\'Continue\')')).or(this.page.locator('form button >> nth=1'));
  }

  /** Typing the first name Chris into the First Name field. */
  async fillFirstName(value: string): Promise<void> {
    await this.firstNameInput.fill(value);
  }

  /** Typing the last name Tester into the Last Name field. */
  async fillLastName(value: string): Promise<void> {
    await this.lastNameInput.fill(value);
  }

  /** Typing the zip code 01001 into the Zip/Postal Code field. */
  async fillPostalCode(value: string): Promise<void> {
    await this.zipPostalCodeInput.fill(value);
  }

  /** Clicking the Continue button to proceed to the checkout overview page. */
  async clickContinue(): Promise<void> {
    await this.continueElement.click();
  }
}
