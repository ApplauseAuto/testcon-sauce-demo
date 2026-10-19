import { type Locator, type Page } from '@playwright/test';
import { BasePage } from '@/pages/base.page';

export class CheckoutPage extends BasePage {
  constructor(protected readonly page: Page) {
    super(page);
  }

  get firstNameInput(): Locator {
    return this.page.locator('role=textbox[name="First Name"]').or(this.page.locator('input#first-name')).or(this.page.locator('form input:nth-of-type(1)'));
  }

  get lastNameInput(): Locator {
    return this.page.locator('role=textbox[name="Last Name"]').or(this.page.locator('input#last-name')).or(this.page.locator('form input:nth-of-type(2)'));
  }

  get zipPostalCodeInput(): Locator {
    return this.page.locator('role=textbox[name="Zip/Postal Code"]').or(this.page.locator('input#postal-code')).or(this.page.locator('form input:nth-of-type(3)'));
  }

  get continueElement(): Locator {
    return this.page.locator('role=button[name="Continue"]').or(this.page.locator('button:has-text(\'Continue\')')).or(this.page.locator('input#continue'));
  }

  /** Entering the first name Chris into the First Name field. */
  async fillFirstName(value: string): Promise<void> {
    await this.firstNameInput.fill(value);
  }

  /** Entering the last name Tester into the Last Name field. */
  async fillLastName(value: string): Promise<void> {
    await this.lastNameInput.fill(value);
  }

  /** Entering the zip code 01001 into the Zip/Postal Code field. */
  async fillPostalCode(value: string): Promise<void> {
    await this.zipPostalCodeInput.fill(value);
  }

  /** Clicking Continue to proceed to the checkout overview step. */
  async clickContinue(): Promise<void> {
    await this.continueElement.click();
  }
}
