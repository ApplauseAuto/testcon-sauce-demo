import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from '@/pages/base.page';

export class InventoryPage extends BasePage {
  constructor(protected readonly page: Page) {
    super(page);
  }

  get addToCartButton(): Locator {
    return this.page.locator('button:has-text(\'Add to cart\')').or(this.page.locator('role=button[name=\'Add to cart\']')).or(this.page.locator('button[id*=\'backpack\']')).or(this.page.locator('button:has-text(\'Add to cart\')[]')).or(this.page.locator('button[aria-label=\'Add to cart\'] >> nth=0')).or(this.page.locator('text=Sauce Labs Backpack'));
  }

  get cartElement(): Locator {
    return this.page.locator('.shopping_cart_link').or(this.page.locator('role=button[name=\'Cart\']')).or(this.page.locator('[data-test=\'shopping-cart-link\']'));
  }

  get sortProductsSelect(): Locator {
    return this.page.locator('select[data-test=\'product-sort-container\']').or(this.page.locator('combobox[name=\'Sort products\']')).or(this.page.locator('select.product_sort_container'));
  }

  get addToCartButton2(): Locator {
    return this.page.locator('button:has-text(\'Add to cart\')').or(this.page.locator('role=button[name=\'Add to cart\']')).or(this.page.locator('[data-test=\'add-to-cart\']'));
  }

  get shoppingCartBadgeElement(): Locator {
    return this.page.locator('role=button[name=/Cart/]').or(this.page.locator('.shopping_cart_badge')).or(this.page.locator('[data-test=\'shopping-cart-badge\']'));
  }

  /** Clicking Add to cart for the Sauce Labs Backpack product. */
  async addBackpackToCart(): Promise<void> {
    await this.addToCartButton.click();
  }

  /** Opening the shopping cart to view added items. */
  async openCart(): Promise<void> {
    await this.cartElement.click();
  }

  /** Selecting 'Price (low to high)' from the sort dropdown to reorder products by price. */
  async sortProductsByPriceLowToHigh(value: string): Promise<void> {
    await this.sortProductsSelect.selectOption(value);
  }

  /** Clicking Add to cart for the Sauce Labs Backpack product. */
  async addBackpackToCart2(): Promise<void> {
    await this.addToCartButton2.click();
  }

  /** Verifying the shopping cart icon shows a count of 1 after adding the item. */
  async expectCartBadgeCount(): Promise<void> {
    await expect(this.shoppingCartBadgeElement).toContainText("1");
  }
}
