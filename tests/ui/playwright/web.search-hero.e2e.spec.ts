import { expect, test } from '@playwright/test';

test.describe('web search + hero flow', () => {
  test('search suggestions show history/trending/category hints and navigate', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.locator('header input[name="q"]').first();
    await expect(searchInput).toBeVisible();

    await searchInput.fill('پرچمدار');

    const suggestionLink = page.getByRole('link', { name: /پرچمدار/i }).first();
    await expect(suggestionLink).toBeVisible();

    await suggestionLink.click();
    await expect(page).toHaveURL(/\/categories\?/);
  });

  test('hero three-column structure remains visible on desktop and mobile', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    const heroSection = page.locator('section').filter({ hasText: 'Hero سه‌ستونه AIMarket' }).first();
    await expect(heroSection).toBeVisible();
    await expect(heroSection.getByText('دسته‌بندی‌ها', { exact: true })).toBeVisible();
    await expect(heroSection.getByText('Campaign Control Center')).toBeVisible();
    await expect(heroSection.getByText('پنل کاربر', { exact: true })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();

    const mobileHero = page.locator('section').filter({ hasText: 'Hero سه‌ستونه AIMarket' }).first();
    await expect(mobileHero).toBeVisible();
    await expect(mobileHero.getByText('پنل کاربر', { exact: true })).toBeVisible();
  });
});
