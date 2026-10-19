import { test, expect } from '@/fixtures/base';
import { LoginPage } from '@/pages/swag-labs/login.page';
import { InventoryPage } from '@/pages/swag-labs/inventory.page';
import { CartPage } from '@/pages/swag-labs/cart.page';
import { CheckoutPage } from '@/pages/swag-labs/checkout.page';
import { CheckoutOverviewPage } from '@/pages/swag-labs/checkout-overview.page';
import { CheckoutCompletePage } from '@/pages/swag-labs/checkout-complete.page';

test.describe("Checkout completes @regression @parallel-safe @swag-labs", () => {
  test("Checkout completes", async ({ page, env }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);
    const cartPage = new CartPage(page);
    const checkoutPage = new CheckoutPage(page);
    const checkoutOverviewPage = new CheckoutOverviewPage(page);
    const checkoutCompletePage = new CheckoutCompletePage(page);
    await page.goto(`${process.env.URL}`);
    await test.step("Typing the username into the Username field.", async () => {
      await loginPage.fillUsername((env.raw.TEST_USERNAME ?? ''));
    });
    await test.step("Typing the password into the Password field.", async () => {
      await loginPage.fillPassword((env.raw.TEST_PASSWORD ?? ''));
    });
    await test.step("Clicking the Login button to submit credentials.", async () => {
      await loginPage.clickLogin();
    });
    await test.step("Clicking Add to cart for the Sauce Labs Backpack product.", async () => {
      await inventoryPage.addBackpackToCart();
    });
    // Verify: Cart icon shows one item after adding the backpack
    await expect(page.getByRole('button', { name: 'Cart, 1 items' })).toBeVisible();
    await test.step("Opening the shopping cart to view added items.", async () => {
      await inventoryPage.openCart();
    });
    await test.step("Clicking Checkout button to proceed to the checkout information step.", async () => {
      await cartPage.clickCheckout();
    });
    await test.step("Entering the first name Chris into the First Name field.", async () => {
      await checkoutPage.fillFirstName("Chris");
    });
    await test.step("Entering the last name Tester into the Last Name field.", async () => {
      await checkoutPage.fillLastName("Tester");
    });
    await test.step("Entering the zip code 01001 into the Zip/Postal Code field.", async () => {
      await checkoutPage.fillPostalCode("01001");
    });
    await test.step("Clicking Continue to proceed to the checkout overview step.", async () => {
      await checkoutPage.clickContinue();
    });
    await test.step("Clicking the Finish button to complete the checkout process.", async () => {
      await checkoutOverviewPage.clickFinish();
    });
    await test.step("Verifying the order confirmation heading reads Thank you for your order to confirm checkout completed successfully.", async () => {
      await checkoutCompletePage.expectThankYouMessage();
    });
  });
});
