import { test } from '@/fixtures/base';
import { LoginPage } from '@/pages/swag-labs/login.page';
import { InventoryPage } from '@/pages/swag-labs/inventory.page';

test.describe("Add to cart shows the badge @regression @parallel-safe @swag-labs", () => {
  test("Add to cart shows the badge", async ({ page, env }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);
    await page.goto(`${process.env.URL}`);
    await test.step("Typing the username into the Username field to begin login.", async () => {
      await loginPage.fillUsername((env.raw.TEST_USERNAME ?? ''));
    });
    await test.step("Typing the password into the Password field.", async () => {
      await loginPage.fillPassword((env.raw.TEST_PASSWORD ?? ''));
    });
    await test.step("Clicking the Login button to submit the credentials.", async () => {
      await loginPage.clickLogin();
    });
    await test.step("Placeholder", async () => {
      await inventoryPage.addBackpackToCart();
    });
    await test.step("Clicking Add to cart for the Sauce Labs Backpack product.", async () => {
      await inventoryPage.addBackpackToCart2();
    });
    await test.step("Verifying the shopping cart icon shows a count of 1 after adding the item.", async () => {
      await inventoryPage.expectCartBadgeCount();
    });
  });
});
