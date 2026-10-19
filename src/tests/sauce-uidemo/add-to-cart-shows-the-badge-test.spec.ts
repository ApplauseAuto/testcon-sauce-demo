import { test } from '@/fixtures/base';
import { LoginPage } from '@/pages/sauce-uidemo/login.page';
import { ProductsPage } from '@/pages/sauce-uidemo/products.page';

test.describe("Add to cart shows the badge test @regression @parallel-safe @sauce-uidemo", () => {
  test("Add to cart shows the badge test", async ({ page, env }) => {
    const loginPage = new LoginPage(page);
    const productsPage = new ProductsPage(page);
    await page.goto(`${process.env.BASE_URL}`);
    await test.step("Typing the standard_user username into the Username field.", async () => {
      await loginPage.fillUsername((env.raw.TEST_USERNAME ?? ''));
    });
    await test.step("Typing the secret_sauce password into the Password field.", async () => {
      await loginPage.fillPassword((env.raw.TEST_PASSWORD ?? ''));
    });
    await test.step("Clicking the Login button to submit the login form.", async () => {
      await loginPage.clickLogin();
    });
    await test.step("Clicking Add to cart on the Sauce Labs Backpack product to add it to the shopping cart.", async () => {
      await productsPage.addBackpackToCart();
    });
    await test.step("Verifying the shopping cart badge shows 1 item after adding the backpack.", async () => {
      await productsPage.expectCartBadgeCount();
    });
  });
});
