import { expect, test } from '@playwright/test';

test.describe('web profile/orders locale', () => {
  test('profile switches to LTR', async ({ page }) => {
    await page.goto('/locale?lang=en&next=/profile');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByTestId('profile-title')).toContainText('Profile');
  });

  test('orders switches to RTL', async ({ page }) => {
    await page.goto('/locale?lang=fa&next=/orders');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('orders-title')).toContainText('سفارش');
  });
});
