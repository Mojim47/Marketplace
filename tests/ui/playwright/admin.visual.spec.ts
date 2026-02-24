import { expect, test } from '@playwright/test';

const authCookie = {
  name: 'admin-token',
  value: 'test',
  domain: 'localhost',
  path: '/',
};

test.describe('admin visual', () => {
  test('login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('admin-login-title')).toBeVisible();
    await expect(page).toHaveScreenshot('admin-login.png', { fullPage: true });
  });

  test('dashboard page', async ({ page }) => {
    await page.context().addCookies([authCookie]);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /مرکز فرماندهی ادمین/ })).toBeVisible();
    await expect(page).toHaveScreenshot('admin-dashboard.png', { fullPage: true });
  });

  test('management reports page', async ({ page }) => {
    await page.context().addCookies([authCookie]);
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: /Management Strategy Panel/i })).toBeVisible();
    await expect(page).toHaveScreenshot('admin-reports.png', { fullPage: true });
  });
});
