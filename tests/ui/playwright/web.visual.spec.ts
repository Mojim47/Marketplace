import { expect, test } from '@playwright/test';

test.describe('web visual', () => {
  test('home page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /بازار/ })).toBeVisible();
    await expect(page).toHaveScreenshot('web-home.png');
  });

  test('home hero mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByText('Hero سه‌ستونه AIMarket')).toBeVisible();
    await expect(page).toHaveScreenshot('web-home-mobile.png');
  });
});
