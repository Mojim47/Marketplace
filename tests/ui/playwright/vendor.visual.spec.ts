import { expect, test } from '@playwright/test';

test.describe('vendor visual', () => {
  test('dashboard page', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /داشبورد فروشنده/ })).toBeVisible();
    await expect(page).toHaveScreenshot('vendor-dashboard.png', { fullPage: true });
  });

  test('products page', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: /محصولات/ })).toBeVisible();
    await expect(page).toHaveScreenshot('vendor-products.png', { fullPage: true });
  });

  test('orders page', async ({ page }) => {
    await page.goto('/orders');
    await expect(page.getByRole('heading', { name: /سفارش ها/ })).toBeVisible();
    await expect(page).toHaveScreenshot('vendor-orders.png', { fullPage: true });
  });

  test('analytics page', async ({ page }) => {
    await page.goto('/analytics');
    await expect(page.getByRole('heading', { name: /تحلیل فروش/ })).toBeVisible();
    await expect(page).toHaveScreenshot('vendor-analytics.png', { fullPage: true });
  });
});

