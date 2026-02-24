import { expect, test } from '@playwright/test';

test.describe('web checkout visual', () => {
  test('cart page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/cart');
    await expect(page.getByTestId('cart-title')).toBeVisible();
    await expect(page).toHaveScreenshot('web-cart.png', {
      fullPage: true,
      maxDiffPixels: 40000,
      maxDiffPixelRatio: 0.03,
    });
  });

  test('cart page mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/cart');
    await expect(page.getByTestId('cart-title')).toBeVisible();
    await expect(page).toHaveScreenshot('web-cart-mobile.png', {
      fullPage: true,
      maxDiffPixels: 50000,
      maxDiffPixelRatio: 0.05,
    });
  });

  test('checkout page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/checkout');
    await expect(page.getByTestId('checkout-title')).toBeVisible();
    await expect(page).toHaveScreenshot('web-checkout.png', {
      maxDiffPixels: 50000,
      maxDiffPixelRatio: 0.05,
    });
  });

  test('checkout page mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/checkout');
    await expect(page.getByTestId('checkout-title')).toBeVisible();
    await expect(page).toHaveScreenshot('web-checkout-mobile.png', {
      fullPage: true,
      maxDiffPixels: 70000,
      maxDiffPixelRatio: 0.08,
    });
  });

  test('checkout success page', async ({ page }) => {
    await page.goto('/checkout/success');
    await expect(page.getByTestId('checkout-success-title')).toBeVisible();
    await expect(page).toHaveScreenshot('web-checkout-success.png', { fullPage: true });
  });
});
