import { test, expect } from '@playwright/test';

test.describe('web locale switch', () => {
  test('switches to LTR', async ({ page }) => {
    await page.goto('/locale?lang=en&next=/checkout');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByTestId('checkout-title')).toContainText('Secure checkout');
  });

  test('switches back to RTL', async ({ page }) => {
    await page.goto('/locale?lang=fa&next=/checkout');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('checkout-title')).toContainText('تسویه امن');
  });
});
