import { expect, test } from '@playwright/test';

test.describe('web checkout visual', () => {
  test('cart page', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.getByTestId('cart-title')).toBeVisible();
    await expect(page).toHaveScreenshot('web-cart.png', { fullPage: true });
  });

  test('checkout page', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page.getByTestId('checkout-title')).toBeVisible();
    await expect(page).toHaveScreenshot('web-checkout.png', { fullPage: true });
  });

  test('checkout success page', async ({ page }) => {
    await page.goto('/checkout/success');
    await expect(page.getByTestId('checkout-success-title')).toBeVisible();
    await expect(page).toHaveScreenshot('web-checkout-success.png', { fullPage: true });
  });
});
