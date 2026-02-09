import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('web profile/orders a11y', () => {
  test('profile page', async ({ page }) => {
    await page.goto('/profile');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('orders page', async ({ page }) => {
    await page.goto('/orders');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
