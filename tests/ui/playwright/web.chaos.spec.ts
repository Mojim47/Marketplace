import { expect, test } from '@playwright/test';

test.describe('web chaos ux', () => {
  test('home tolerates api failures', async ({ page }) => {
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 500, body: '{}', contentType: 'application/json' })
    );
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /بازار/ })).toBeVisible();
    await expect(page.locator('text=Internal Server Error')).toHaveCount(0);
  });
});
