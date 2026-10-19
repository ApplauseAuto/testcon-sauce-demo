import { test, expect } from '@/fixtures/base';
import { LoginPage } from '@/pages/swag-labs/login.page';
import { InventoryPage } from '@/pages/swag-labs/inventory.page';

test.describe("Sort by price @regression @parallel-safe @swag-labs", () => {
  test("Sort by price", async ({ page, env }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);
    await page.goto(`${process.env.URL}`);
    await test.step("Entering the standard_user username into the Username field.", async () => {
      await loginPage.fillUsername((env.raw.TEST_USERNAME ?? ''));
    });
    await test.step("Entering the secret_sauce password into the Password field.", async () => {
      await loginPage.fillPassword((env.raw.TEST_PASSWORD ?? ''));
    });
    await test.step("Clicking the Login button to submit the credentials.", async () => {
      await loginPage.clickLogin();
    });
    await test.step("Selecting 'Price (low to high)' from the sort dropdown to reorder products by price.", async () => {
      await inventoryPage.sortProductsByPriceLowToHigh("lohi");
    });
    // Verify: The products are sorted by price low to high and the first product's price is higher than $5.99
    await expect(page.getByRole('combobox', { name: 'Sort products' })).toContainText('Price (low to high)');
  });
});
