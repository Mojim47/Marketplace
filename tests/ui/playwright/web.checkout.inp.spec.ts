import { test, expect } from '@playwright/test';

test.describe('web checkout INP', () => {
  test('checkout INP under 200ms', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __inpEntries?: number[] }).__inpEntries = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const eventEntry = entry as PerformanceEntry & { duration: number; name: string };
          if (eventEntry.duration > 0 && ['click', 'pointerdown', 'pointerup', 'keydown', 'keyup'].includes(eventEntry.name)) {
            (window as unknown as { __inpEntries?: number[] }).__inpEntries?.push(eventEntry.duration);
          }
        }
      }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
    });

    await page.goto('/checkout');
    await page.fill('#checkout-fullname', 'Test User');
    await page.fill('#checkout-phone', '09120000000');
    await page.fill('#checkout-address', 'Tehran, Example St');
    await page.getByTestId('checkout-submit').click();
    await page.waitForTimeout(200);

    const inp = await page.evaluate(() => {
      const entries = (window as unknown as { __inpEntries?: number[] }).__inpEntries ?? [];
      return entries.reduce((max, value) => Math.max(max, value), 0);
    });

    expect(inp).toBeGreaterThan(0);
    expect(inp).toBeLessThanOrEqual(200);
  });
});
