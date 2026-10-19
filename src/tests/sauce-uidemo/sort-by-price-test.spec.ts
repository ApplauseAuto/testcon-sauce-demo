import { test } from '@/fixtures/base';
import { LoginPage } from '@/pages/sauce-uidemo/login.page';
import { ProductsPage } from '@/pages/sauce-uidemo/products.page';

test.describe("Sort by price test @regression @parallel-safe @sauce-uidemo", () => {
  test("Sort by price test", async ({ page, env }) => {
    const loginPage = new LoginPage(page);
    const productsPage = new ProductsPage(page);
    await page.goto("");
    await test.step("Typing the username into the Username field to begin login.", async () => {
      await loginPage.fillUsername2((env.raw.TEST_USERNAME ?? ''));
    });
    await test.step("Typing the password into the Password field.", async () => {
      await loginPage.fillPassword2((env.raw.TEST_PASSWORD ?? ''));
    });
    await test.step("Clicking the Login button to submit the credentials.", async () => {
      await loginPage.clickLogin2();
    });
    await test.step("Selecting 'Price (low to high)' from the product sort dropdown.", async () => {
      await productsPage.sortProductsByPriceLowToHigh("lohi");
    });
  });
});
