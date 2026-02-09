import { expect, test } from '@playwright/test';

test.describe('web profile e2e', () => {
  test('updates profile successfully', async ({ page }) => {
    await page.goto('/locale?lang=en&next=/profile');
    await page.fill('#profile-fullname', 'Test User');
    await page.fill('#profile-email', 'user@example.com');
    await page.fill('#profile-phone', '09120000000');
    await page.getByTestId('profile-submit').click();
    await expect(page.getByRole('status')).toContainText('Profile updated');
  });
});
