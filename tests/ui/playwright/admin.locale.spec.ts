import { test, expect } from '@playwright/test';

test.describe('admin locale switch', () => {
  test('switches to LTR', async ({ page }) => {
    await page.goto('/locale?lang=en&next=/login');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByTestId('admin-login-title')).toContainText('Admin Sign In');
  });

  test('switches back to RTL', async ({ page }) => {
    await page.goto('/locale?lang=fa&next=/login');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('admin-login-title')).toContainText('ورود مدیران');
  });
});
