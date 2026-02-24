import { expect, test } from '@playwright/test';

test.describe('web profile e2e', () => {
  test('updates profile successfully', async ({ page }) => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: 'user-1',
        role: 'USER',
        mobile: '09120000000',
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString('base64url');

    await page.context().addCookies([
      {
        name: 'access_token',
        value: `${header}.${payload}.sig`,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
      {
        name: 'auth_user',
        value: JSON.stringify({
          id: 'user-1',
          role: 'USER',
          firstName: 'Test',
          lastName: 'User',
          mobile: '09120000000',
        }),
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        sameSite: 'Lax',
      },
    ]);

    await page.goto('/locale?lang=en&next=/profile');
    await page.fill('#profile-fullname', 'Test User');
    await page.fill('#profile-phone', '09120000000');
    await page.getByTestId('profile-submit').click();
    await expect(page.getByRole('status')).toContainText('Profile updated');
  });
});
