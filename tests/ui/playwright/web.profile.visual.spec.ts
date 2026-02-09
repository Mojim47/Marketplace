import { expect, test } from '@playwright/test';

test.describe('web profile/orders visual', () => {
  test('profile page', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByTestId('profile-title')).toBeVisible();
    await expect(page).toHaveScreenshot('web-profile.png', { fullPage: true });
  });

  test('orders page', async ({ page }) => {
    await page.goto('/orders');
    await expect(page.getByTestId('orders-title')).toBeVisible();
    await expect(page).toHaveScreenshot('web-orders.png', { fullPage: true });
  });
});
