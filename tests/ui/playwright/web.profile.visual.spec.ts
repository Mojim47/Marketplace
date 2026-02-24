import { expect, test } from '@playwright/test';

test.describe('web profile/orders visual', () => {
  test('profile page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/profile');
    await expect(page.getByTestId('profile-title')).toBeVisible();
    await expect(page).toHaveScreenshot('web-profile.png', { fullPage: true });
  });

  test('profile page mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/profile');
    await expect(page.getByTestId('profile-title')).toBeVisible();
    await expect(page).toHaveScreenshot('web-profile-mobile.png', {
      fullPage: true,
      maxDiffPixels: 65000,
      maxDiffPixelRatio: 0.08,
    });
  });

  test('orders page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/orders');
    await expect(page.getByTestId('orders-title')).toBeVisible();
    await expect(page).toHaveScreenshot('web-orders.png', { fullPage: true });
  });

  test('orders page mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/orders');
    await expect(page.getByTestId('orders-title')).toBeVisible();
    await expect(page).toHaveScreenshot('web-orders-mobile.png', {
      fullPage: true,
      maxDiffPixels: 65000,
      maxDiffPixelRatio: 0.08,
    });
  });
});
