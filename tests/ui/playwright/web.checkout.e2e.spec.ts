import { test, expect } from '@playwright/test';

test.describe('web checkout flow', () => {
  test('cart to success', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.getByTestId('cart-title')).toBeVisible();

    await page.getByTestId('cart-checkout-cta').click();
    await expect(page.getByTestId('checkout-title')).toBeVisible();

    await page.fill('#checkout-fullname', 'Test User');
    await page.fill('#checkout-phone', '09120000000');
    await page.fill('#checkout-address', 'Tehran, Example St');

    await page.getByTestId('checkout-submit').click();
    await expect(page.getByTestId('checkout-success-title')).toBeVisible();
  });
});
