import { test, expect } from '@/fixtures/base';
import { LoginPage } from '@/pages/sauce-uidemo/login.page';
import { ProductsPage } from '@/pages/sauce-uidemo/products.page';
import { CartPage } from '@/pages/sauce-uidemo/cart.page';
import { CheckoutPage } from '@/pages/sauce-uidemo/checkout.page';
import { CheckoutOverviewPage } from '@/pages/sauce-uidemo/checkout-overview.page';
import { ConfirmationPage } from '@/pages/sauce-uidemo/confirmation.page';

test.describe("Checkout completes test @regression @parallel-safe @sauce-uidemo", () => {
  test("Checkout completes test", async ({ page, env }) => {
    const loginPage = new LoginPage(page);
    const productsPage = new ProductsPage(page);
    const cartPage = new CartPage(page);
    const checkoutPage = new CheckoutPage(page);
    const checkoutOverviewPage = new CheckoutOverviewPage(page);
    const confirmationPage = new ConfirmationPage(page);
    await page.goto(`${process.env.BASE_URL}`);
    await test.step("Typing the username into the Username field to begin login.", async () => {
      await loginPage.fillUsername2((env.raw.TEST_USERNAME ?? ''));
    });
    await test.step("Typing the password into the Password field.", async () => {
      await loginPage.fillPassword2((env.raw.TEST_PASSWORD ?? ''));
    });
    await test.step("Clicking the Login button to submit credentials.", async () => {
      await loginPage.clickLogin2();
    });
    await test.step("Clicking Add to cart for the Sauce Labs Backpack product.", async () => {
      await productsPage.addBackpackToCart2();
    });
    // Verify: Cart icon shows one item after adding the backpack
    await expect(page.getByRole('button', { name: 'Cart, 1 items' })).toBeVisible();
    await test.step("Opening the shopping cart to review items.", async () => {
      await productsPage.openCart();
    });
    await test.step("Clicking Checkout to proceed to the checkout information page.", async () => {
      await cartPage.clickCheckout();
    });
    await test.step("Typing the first name Chris into the First Name field.", async () => {
      await checkoutPage.fillFirstName("Chris");
    });
    await test.step("Typing the last name Tester into the Last Name field.", async () => {
      await checkoutPage.fillLastName("Tester");
    });
    await test.step("Typing the zip code 01001 into the Zip/Postal Code field.", async () => {
      await checkoutPage.fillPostalCode("01001");
    });
    await test.step("Clicking the Continue button to proceed to the checkout overview page.", async () => {
      await checkoutPage.clickContinue();
    });
    await test.step("Clicking the Finish button to complete the checkout process.", async () => {
      await checkoutOverviewPage.clickFinish();
    });
    await test.step("Verifying the confirmation heading confirms the order completed successfully.", async () => {
      await confirmationPage.expectConfirmationMessage();
    });
  });
});
