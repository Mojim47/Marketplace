import { expect, test } from '@playwright/test';

test.describe('admin login INP', () => {
  test('login INP under 200ms', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __inpEntries?: number[] }).__inpEntries = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const eventEntry = entry as PerformanceEntry & { duration: number; name: string };
          if (
            eventEntry.duration > 0 &&
            ['click', 'pointerdown', 'pointerup', 'keydown', 'keyup'].includes(eventEntry.name)
          ) {
            (window as unknown as { __inpEntries?: number[] }).__inpEntries?.push(
              eventEntry.duration
            );
          }
        }
      }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
    });

    await page.goto('/login');
    await page.getByTestId('admin-login-email').fill('admin@example.com');
    await page.getByTestId('admin-login-password').fill('P@ssw0rd!');
    await page.getByTestId('admin-login-submit').click();
    await page.waitForTimeout(200);

    const inp = await page.evaluate(() => {
      const entries = (window as unknown as { __inpEntries?: number[] }).__inpEntries ?? [];
      return entries.reduce((max, value) => Math.max(max, value), 0);
    });

    expect(inp).toBeGreaterThan(0);
    expect(inp).toBeLessThanOrEqual(200);
  });
});
