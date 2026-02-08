import { test, expect } from '@playwright/test';

test.describe('admin login e2e', () => {
  test('login flow reaches dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('admin-login-email').fill('admin@example.com');
    await page.getByTestId('admin-login-password').fill('P@ssw0rd!');
    await page.getByTestId('admin-login-submit').click();
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('admin-dashboard-title')).toBeVisible();
  });
});
