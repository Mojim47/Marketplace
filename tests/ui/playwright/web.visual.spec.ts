import { expect, test } from '@playwright/test';

test.describe('web visual', () => {
  test('home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /بازار/ })).toBeVisible();
    await expect(page).toHaveScreenshot('web-home.png', { fullPage: true });
  });
});
