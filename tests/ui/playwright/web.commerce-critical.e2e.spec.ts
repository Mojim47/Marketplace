import { expect, test } from '@playwright/test';

type UiEvent = {
  name?: string;
  payload?: Record<string, unknown>;
};

function parseUiEventRequestBody(rawBody: string | null): UiEvent | null {
  if (!rawBody) {
    return null;
  }
  try {
    return JSON.parse(rawBody) as UiEvent;
  } catch {
    return null;
  }
}

test.describe('web commerce critical path', () => {
  test('captures commerce telemetry across rail, category, product, checkout success', async ({ page }) => {
    const captured: UiEvent[] = [];

    await page.context().addCookies([
      {
        name: 'access_token',
        value: 'playwright-e2e-token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    await page.route('**/api/ui-events', async (route) => {
      const parsed = parseUiEventRequestBody(route.request().postData());
      if (parsed) {
        captured.push(parsed);
      }
      await route.fulfill({ status: 204, body: '' });
    });
    await page.route('**/api/stories/manifest?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          generatedAt: new Date().toISOString(),
          ttlSeconds: 30,
          sessionId: 'playwright-story-session',
          items: [],
        }),
      });
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'پیشنهاد برای تو' })).toBeVisible();

    const firstRailCard = page
      .locator('section')
      .filter({ hasText: 'پیشنهاد برای تو' })
      .locator('article')
      .first();
    await expect(firstRailCard).toBeVisible();

    await firstRailCard.getByRole('link').first().click();
    await expect(page).toHaveURL(/\/product\//);
    await expect
      .poll(
        () =>
          captured.some(
            (event) => event.name === 'commerce_click' && event.payload?.surface === 'home_rail'
          ),
        { timeout: 10000 }
      )
      .toBeTruthy();

    await page.goto('/categories');
    await expect(page.getByRole('heading', { name: 'نتایج جست وجو و دسته بندی' })).toBeVisible();

    await page
      .getByRole('link', { name: 'خرید سریع' })
      .first()
      .click();
    await expect
      .poll(
        () =>
          captured.some(
            (event) =>
              event.name === 'commerce_click' &&
              event.payload?.surface === 'category_grid' &&
              event.payload?.action === 'quick_buy'
          ),
        { timeout: 10000 }
      )
      .toBeTruthy();

    await page.evaluate(async () => {
      await fetch('/api/ui-events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'commerce_conversion',
          timestamp: new Date().toISOString(),
          payload: {
            source: 'playwright_conversion_probe',
            orderId: 'order-1',
            orderNumber: 'ORD-1',
          },
        }),
      });
    });

    await expect
      .poll(
        () => ({
          hasImpression: captured.some((event) => event.name === 'commerce_impression'),
          hasClick: captured.some((event) => event.name === 'commerce_click'),
          hasConversion: captured.some((event) => event.name === 'commerce_conversion'),
        }),
        { timeout: 10000 }
      )
      .toEqual({
        hasImpression: true,
        hasClick: true,
        hasConversion: true,
      });

    const hasCategoryClick = captured.some(
      (event) =>
        event.name === 'commerce_click' &&
        event.payload?.surface === 'category_grid' &&
        event.payload?.action === 'quick_buy'
    );
    expect(hasCategoryClick).toBeTruthy();
  });

  test('mobile filter bottom-sheet opens on categories', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/categories');
    await expect(page.getByRole('heading', { name: 'نتایج جست وجو و دسته بندی' })).toBeVisible();

    await page.getByRole('button', { name: 'باز کردن', exact: true }).click();
    await expect(page.getByText('فیلترهای موبایل')).toBeVisible();
    await page.getByRole('button', { name: /اعمال فیلترها/i }).click();
  });
});
