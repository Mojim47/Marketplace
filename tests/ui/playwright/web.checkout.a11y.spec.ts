import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('web checkout a11y', () => {
  test('cart page', async ({ page }) => {
    await page.goto('/cart');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('checkout page', async ({ page }) => {
    await page.goto('/checkout');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('checkout success page', async ({ page }) => {
    await page.goto('/checkout/success');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
