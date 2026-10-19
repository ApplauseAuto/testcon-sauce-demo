import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from '@/pages/base.page';

export class ProductsPage extends BasePage {
  constructor(protected readonly page: Page) {
    super(page);
  }

  get addToCartButton(): Locator {
    return this.page.locator('button:has-text(\'Add to cart\')').or(this.page.locator('xpath=//button[@id=\'add-to-cart-sauce-labs-backpack\']')).or(this.page.locator('div:has(button[aria-label*=\'Sauce Labs Backpack\']) button:has-text(\'Add to cart\')'));
  }

  get shoppingCartBadgeElement(): Locator {
    return this.page.locator('span.shopping_cart_badge').or(this.page.locator('[data-test=\'shopping-cart-badge\']')).or(this.page.locator('.shopping_cart_badge'));
  }

  get sortProductsSelect(): Locator {
    return this.page.locator('select[data-test=\'product-sort-container\']').or(this.page.locator('select[aria-label=\'Sort products\']')).or(this.page.locator('combobox[name=\'Sort products\']'));
  }

  get addToCartButton2(): Locator {
    return this.page.locator('button:has-text(\'Add to cart\')').or(this.page.locator('xpath=//div[contains(text(),\'Sauce Labs Backpack\')]/ancestor::div[contains(@class,\'inventory_item\')]//button')).or(this.page.locator('[data-test=\'add-to-cart-sauce-labs-backpack\']'));
  }

  get cart1ItemButton(): Locator {
    return this.page.locator('button[aria-label=\'Cart, 1 item\']').or(this.page.locator('a.shopping_cart_link')).or(this.page.locator('.shopping_cart_link'));
  }

  /** Clicking Add to cart on the Sauce Labs Backpack product to add it to the shopping cart. */
  async addBackpackToCart(): Promise<void> {
    await this.addToCartButton.click();
  }

  /** Verifying the shopping cart badge shows 1 item after adding the backpack. */
  async expectCartBadgeCount(): Promise<void> {
    await expect(this.shoppingCartBadgeElement).toHaveText("1");
  }

  /** Selecting 'Price (low to high)' from the product sort dropdown. */
  async sortProductsByPriceLowToHigh(value: string): Promise<void> {
    await this.sortProductsSelect.selectOption(value);
  }

  /** Clicking Add to cart for the Sauce Labs Backpack product. */
  async addBackpackToCart2(): Promise<void> {
    await this.addToCartButton2.click();
  }

  /** Opening the shopping cart to review items. */
  async openCart(): Promise<void> {
    await this.cart1ItemButton.click();
  }
}
