import { expect, test } from '@playwright/test';

test.describe('web commerce resilience under constrained runtime', () => {
  test('critical surfaces remain usable under cpu x4 and 3g network profile', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 400,
      downloadThroughput: 400 * 1024,
      uploadThroughput: 300 * 1024,
      connectionType: 'cellular3g',
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    try {
      const loginStart = Date.now();
      await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'ورود به حساب کاربری' })).toBeVisible();
      const loginInteractiveMs = Date.now() - loginStart;
      expect(loginInteractiveMs).toBeLessThan(15000);

      await expect(page.locator('#login-identifier')).toBeVisible();
      await page.locator('#login-identifier').fill('09123456789');
      await page.locator('#login-password').fill('pass-1234');

      const categoriesStart = Date.now();
      await page.goto('/categories', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'نتایج جست وجو و دسته بندی' })).toBeVisible();
      const categoriesInteractiveMs = Date.now() - categoriesStart;
      expect(categoriesInteractiveMs).toBeLessThan(18000);

      const productLink = page.locator('a[href^="/product/"]').first();
      await expect(productLink).toBeVisible({
        timeout: 20000,
      });
      await productLink.click();
      await expect(page).toHaveURL(/\/product\//);
    } finally {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => undefined);
      await cdp
        .send('Network.emulateNetworkConditions', {
          offline: false,
          latency: 0,
          downloadThroughput: -1,
          uploadThroughput: -1,
          connectionType: 'none',
        })
        .catch(() => undefined);
    }
  });
});
