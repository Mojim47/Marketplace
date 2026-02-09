import { expect, test } from '@playwright/test';

test.describe('web orders e2e', () => {
  test('views order list', async ({ page }) => {
    await page.goto('/orders');
    await expect(page.getByTestId('orders-list')).toBeVisible();
    await page.getByTestId('order-view-NX-2049').click();
  });
});
