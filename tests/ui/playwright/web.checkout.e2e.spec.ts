import { expect, test } from '@playwright/test';

type UiEvent = {
  name: string;
  payload: Record<string, unknown>;
};

async function readUiEvents(page: import('@playwright/test').Page): Promise<UiEvent[]> {
  return page.evaluate(() => {
    const events = (window as unknown as { __uiEvents?: UiEvent[] }).__uiEvents;
    return events || [];
  });
}

type TransitionLog = {
  type: 'flow_transition' | 'guard_blocked';
  prev: string;
  next: string;
  reason: string;
  details?: Record<string, unknown>;
};

function attachTransitionCollector(page: import('@playwright/test').Page) {
  const logs: TransitionLog[] = [];
  page.on('console', (message) => {
    const text = message.text();
    try {
      const parsed = JSON.parse(text) as TransitionLog;
      if (parsed.type === 'flow_transition' || parsed.type === 'guard_blocked') {
        logs.push(parsed);
      }
    } catch {
      // Ignore non-json console output
    }
  });
  return logs;
}

test.describe('web critical e2e', () => {
  test('login success', async ({ page }) => {
    await page.context().addCookies([
      {
        name: 'access_token',
        value: 'e2e-token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          user: {
            id: 'user-1',
            email: 'user@example.com',
            role: 'USER',
            firstName: 'Test',
            lastName: 'User',
          },
        }),
      });
    });

    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          'content-type': 'application/json',
          'set-cookie': 'access_token=e2e-token; Path=/; HttpOnly; SameSite=Lax',
        },
        body: JSON.stringify({
          ok: true,
          user: {
            id: 'user-1',
            email: 'user@example.com',
            role: 'USER',
            firstName: 'Test',
            lastName: 'User',
            mobile: '09120000000',
          },
        }),
      });
    });

    await page.goto('/auth/login');
    await page.fill('#login-identifier', '09120000000');
    await page.fill('#login-password', 'Password@123');
    await page.getByRole('button', { name: 'ورود' }).click();

    await expect(page).toHaveURL(/\/cart/);
    await expect(page.getByTestId('cart-title')).toBeVisible();
  });

  test('login failure', async ({ page }) => {
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'نام کاربري يا رمز عبور اشتباه است' }),
      });
    });

    await page.goto('/auth/login');
    await page.fill('#login-identifier', '09120000000');
    await page.fill('#login-password', 'WrongPass');
    await page.getByRole('button', { name: 'ورود' }).click();

    await expect(page.getByText('نام کاربري يا رمز عبور اشتباه است')).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('checkout success', { timeout: 120000 }, async ({ browser }) => {
    const context = await browser.newContext();
    await context.addCookies([
      {
        name: 'access_token',
        value: 'e2e-token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    const page = await context.newPage();
    const transitionLogs = attachTransitionCollector(page);

    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          user: {
            id: 'user-1',
            email: 'user@example.com',
            role: 'USER',
            firstName: 'Test',
            lastName: 'User',
          },
        }),
      });
    });

    await page.route('**/api/backend/cart', async (route, request) => {
      if (request.method() !== 'GET') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{ productId: 'p1', productName: 'Galaxy Ultra 5G', quantity: 1, price: 45000000 }],
          subtotal: 45000000,
          discount: 0,
          shippingCost: 0,
          taxAmount: 4050000,
          total: 49050000,
        }),
      });
    });

    await page.route('**/api/backend/checkout/init', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'sess-1' }) });
    });

    await page.route('**/api/backend/checkout/sess-1/shipping', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.route('**/api/backend/checkout/sess-1/payment', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.route('**/api/backend/checkout/sess-1/complete', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ orderId: 'order-123', orderNumber: 'ORD-123' }),
      });
    });

    await page.goto('/cart');
    await expect(page.getByTestId('cart-title')).toBeVisible();

    await page.goto('/checkout');
    await expect(page.getByTestId('checkout-title')).toBeVisible();
    await page.evaluate(() => {
      window.sessionStorage.setItem('ng_marketplace_state', 'S5_CART_ACTIVE');
    });

    await page.fill('#checkout-fullname', 'Test User');
    await page.fill('#checkout-phone', '09120000000');
    await page.fill('#checkout-province', 'Tehran');
    await page.fill('#checkout-city', 'Tehran');
    await page.fill('#checkout-address', 'Tehran, Example St');
    await page.fill('#checkout-postal', '1111111111');

    await page.getByTestId('checkout-submit').click();
    await expect(page.getByTestId('checkout-success-title')).toBeVisible();
    await expect(page.getByText('ORD-123')).toBeVisible();

    const transitions = transitionLogs
      .filter((event) => event.type === 'flow_transition')
      .map((event) => ({ prev: event.prev, next: event.next, details: event.details || {} }));

    expect(transitions).toEqual(
      expect.arrayContaining([
        { prev: 'S5_CART_ACTIVE', next: 'S6_CHECKOUT_INIT', details: expect.any(Object) },
        { prev: 'S6_CHECKOUT_INIT', next: 'S7_CHECKOUT_SHIPPING_SET', details: expect.any(Object) },
        { prev: 'S7_CHECKOUT_SHIPPING_SET', next: 'S8_CHECKOUT_PAYMENT_SET', details: expect.any(Object) },
        { prev: 'S8_CHECKOUT_PAYMENT_SET', next: 'S9_ORDER_CREATED', details: expect.any(Object) },
      ])
    );

    const hasForbiddenDirectTransition = transitions.some(
      (transition) => transition.prev === 'S6_CHECKOUT_INIT' && transition.next === 'S8_CHECKOUT_PAYMENT_SET'
    );
    expect(hasForbiddenDirectTransition).toBeFalsy();

    const orderCreated = transitionLogs.find(
      (event) =>
        event.type === 'flow_transition' &&
        event.prev === 'S8_CHECKOUT_PAYMENT_SET' &&
        event.next === 'S9_ORDER_CREATED'
    );
    expect(orderCreated).toBeTruthy();
    const orderDetails = (orderCreated?.details || {}) as Record<string, unknown>;
    expect(typeof orderDetails.orderId).toBe('string');
    expect(String(orderDetails.orderId).length).toBeGreaterThan(0);
    expect(typeof orderDetails.orderNumber).toBe('string');
    expect(String(orderDetails.orderNumber).length).toBeGreaterThan(0);

    await context.close();
  });

  test('anonymous user cannot enter checkout state', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/checkout');
    await expect(page).toHaveURL(/\/auth\/login\?next=%2Fcheckout/);

    const events = await readUiEvents(page);
    const reachedCheckoutState = events.some(
      (event) =>
        event.name === 'flow_transition' &&
        ['S6_CHECKOUT_INIT', 'S7_CHECKOUT_SHIPPING_SET', 'S8_CHECKOUT_PAYMENT_SET', 'S9_ORDER_CREATED'].includes(
          String(event.payload.next)
        )
    );
    expect(reachedCheckoutState).toBeFalsy();
  });

  test('401 during checkout transitions to S2 and does not transition to S_ERR', async ({ browser }) => {
    const context = await browser.newContext();
    await context.addCookies([
      {
        name: 'access_token',
        value: 'e2e-token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    const page = await context.newPage();
    const transitionLogs = attachTransitionCollector(page);

    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          user: {
            id: 'user-1',
            email: 'user@example.com',
            role: 'USER',
            firstName: 'Test',
            lastName: 'User',
          },
        }),
      });
    });

    await page.route('**/api/backend/cart', async (route, request) => {
      if (request.method() !== 'GET') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{ productId: 'p1', productName: 'Galaxy Ultra 5G', quantity: 1, price: 45000000 }],
          subtotal: 45000000,
          discount: 0,
          shippingCost: 0,
          taxAmount: 4050000,
          total: 49050000,
        }),
      });
    });

    await page.route('**/api/backend/checkout/init', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: '401 unauthorized' }) });
    });

    await page.goto('/checkout');
    await expect(page.getByTestId('checkout-title')).toBeVisible();
    await page.evaluate(() => {
      window.sessionStorage.setItem('ng_marketplace_state', 'S5_CART_ACTIVE');
    });

    await page.fill('#checkout-fullname', 'Test User');
    await page.fill('#checkout-phone', '09120000000');
    await page.fill('#checkout-province', 'Tehran');
    await page.fill('#checkout-city', 'Tehran');
    await page.fill('#checkout-address', 'Tehran, Example St');
    await page.fill('#checkout-postal', '1111111111');
    await page.getByTestId('checkout-submit').click();

    await expect(page).toHaveURL(/\/auth\/login\?next=(%2Fcheckout|\/checkout)/);

    const hasTokenExpiredTransition = transitionLogs.some(
      (event) => event.type === 'flow_transition' && event.next === 'S2_TOKEN_EXPIRED'
    );
    expect(hasTokenExpiredTransition).toBeTruthy();

    const hasErrorTransition = transitionLogs.some((event) => event.type === 'flow_transition' && event.next === 'S_ERR');
    expect(hasErrorTransition).toBeFalsy();

    await context.close();
  });

  test('does not allow S9 without order identity in transition details', async ({ browser }) => {
    const context = await browser.newContext();
    await context.addCookies([
      {
        name: 'access_token',
        value: 'e2e-token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    const page = await context.newPage();

    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          user: {
            id: 'user-1',
            email: 'user@example.com',
            role: 'USER',
            firstName: 'Test',
            lastName: 'User',
          },
        }),
      });
    });

    await page.route('**/api/backend/cart', async (route, request) => {
      if (request.method() !== 'GET') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{ productId: 'p1', productName: 'Galaxy Ultra 5G', quantity: 1, price: 45000000 }],
          subtotal: 45000000,
          discount: 0,
          shippingCost: 0,
          taxAmount: 4050000,
          total: 49050000,
        }),
      });
    });

    await page.route('**/api/backend/checkout/init', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'sess-1' }) });
    });
    await page.route('**/api/backend/checkout/sess-1/shipping', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
    await page.route('**/api/backend/checkout/sess-1/payment', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
    await page.route('**/api/backend/checkout/sess-1/complete', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });

    await page.goto('/checkout');
    await page.fill('#checkout-fullname', 'Test User');
    await page.fill('#checkout-phone', '09120000000');
    await page.fill('#checkout-province', 'Tehran');
    await page.fill('#checkout-city', 'Tehran');
    await page.fill('#checkout-address', 'Tehran, Example St');
    await page.fill('#checkout-postal', '1111111111');
    await page.getByTestId('checkout-submit').click();

    await expect(page.getByText('order_identity_missing')).toBeVisible();

    const events = await readUiEvents(page);
    const hasOrderCreatedTransition = events.some(
      (event) => event.name === 'flow_transition' && event.payload.next === 'S9_ORDER_CREATED'
    );
    expect(hasOrderCreatedTransition).toBeFalsy();

    const guardBlocked = events.find(
      (event) =>
        event.name === 'flow_transition' &&
        event.payload.next === 'S_ERR' &&
        event.payload.reason === 'checkout_complete_missing_order_identity'
    );
    expect(guardBlocked).toBeTruthy();

    await context.close();
  });
});
