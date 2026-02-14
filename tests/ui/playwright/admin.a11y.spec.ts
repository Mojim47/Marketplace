import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const authCookie = {
  name: 'admin-token',
  value: 'test',
  domain: 'localhost',
  path: '/',
};

test.describe('admin a11y', () => {
  test('login page', async ({ page }) => {
    await page.goto('/login');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('dashboard page', async ({ page }) => {
    await page.context().addCookies([authCookie]);
    await page.goto('/');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
