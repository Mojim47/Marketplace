/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NextGen Marketplace - Authentication E2E Tests
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * تست‌های End-to-End برای فرآیندهای احراز هویت شامل ورود، ثبت‌نام و 2FA
 *
 * @module e2e/auth
 * @requirements 2.4
 */

import { expect, test } from '@playwright/test';

// Test data
const TEST_USER = {
  email: 'test@example.com',
  password: 'Test@123456',
  fullName: 'کاربر تست',
  tenantSlug: 'test-org',
};

const INVALID_USER = {
  email: 'invalid@test.com',
  password: 'wrongpassword',
};

test.describe('احراز هویت - Authentication Flow', () => {
  test.describe('صفحه ورود - Login Page', () => {
    test('باید صفحه ورود را با تمام المان‌های فرم نمایش دهد', async ({ page }) => {
      await page.goto('/login');

      // Check page loads correctly
      await expect(page).toHaveURL(/.*login/);

      // Check form elements exist
      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();

      // Check link to register page
      await expect(page.locator('a[href="/register"]')).toBeVisible();
    });

    test('باید با فیلدهای خالی خطای اعتبارسنجی نمایش دهد', async ({ page }) => {
      await page.goto('/login');

      // Click submit without filling form
      await page.click('button[type="submit"]');

      // Should show validation errors
      await expect(page.locator('text=/email.*required/i, text=/ایمیل.*الزامی/i')).toBeVisible({
        timeout: 5000,
      });
    });

    test('باید با ایمیل نامعتبر خطا نمایش دهد', async ({ page }) => {
      await page.goto('/login');

      // Fill invalid email format
      await page.fill('input[name="email"]', 'invalid-email');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Should show email format error
      await expect(page.locator('text=/invalid.*email/i, text=/ایمیل.*نامعتبر/i')).toBeVisible({
        timeout: 5000,
      });
    });

    test('باید با اطلاعات نادرست خطای احراز هویت نمایش دهد', async ({ page }) => {
      await page.goto('/login');

      // Fill invalid credentials
      await page.fill('input[name="email"]', INVALID_USER.email);
      await page.fill('input[name="password"]', INVALID_USER.password);
      await page.click('button[type="submit"]');

      // Should show authentication error
      await expect(page.locator('[role="alert"], .error, .text-red-500, .bg-red-50')).toBeVisible({
        timeout: 10000,
      });
    });

    test('باید دکمه ارسال در حین بارگذاری غیرفعال شود', async ({ page }) => {
      await page.goto('/login');

      // Fill form
      await page.fill('input[name="email"]', TEST_USER.email);
      await page.fill('input[name="password"]', TEST_USER.password);

      // Click submit and check loading state
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // Button should be disabled during loading
      await expect(submitButton).toBeDisabled({ timeout: 1000 });
    });

    test('باید لینک ثبت‌نام به صفحه صحیح هدایت کند', async ({ page }) => {
      await page.goto('/login');

      // Click register link
      await page.click('a[href="/register"]');

      // Should navigate to register page
      await expect(page).toHaveURL(/.*register/);
    });

    test('باید پیام انقضای نشست را نمایش دهد', async ({ page }) => {
      await page.goto('/login?expired=true');

      // Should show session expired message
      await expect(page.locator('text=/session.*expired/i, text=/نشست.*منقضی/i')).toBeVisible({
        timeout: 5000,
      });
    });
  });

  test.describe('صفحه ثبت‌نام - Register Page', () => {
    test('باید صفحه ثبت‌نام را با تمام فیلدها نمایش دهد', async ({ page }) => {
      await page.goto('/register');

      // Check page loads correctly
      await expect(page).toHaveURL(/.*register/);

      // Check all form fields exist
      await expect(page.locator('input[name="fullName"]')).toBeVisible();
      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();
      await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
      await expect(page.locator('input[name="tenantSlug"]')).toBeVisible();
      await expect(page.locator('select[name="role"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();

      // Check link to login page
      await expect(page.locator('a[href="/login"]')).toBeVisible();
    });

    test('باید با فیلدهای خالی خطای اعتبارسنجی نمایش دهد', async ({ page }) => {
      await page.goto('/register');

      // Click submit without filling form
      await page.click('button[type="submit"]');

      // Should show validation errors
      await expect(page.locator('text=/required/i, text=/الزامی/i').first()).toBeVisible({
        timeout: 5000,
      });
    });

    test('باید عدم تطابق رمز عبور را تشخیص دهد', async ({ page }) => {
      await page.goto('/register');

      // Fill form with mismatched passwords
      await page.fill('input[name="fullName"]', TEST_USER.fullName);
      await page.fill('input[name="email"]', 'new@test.com');
      await page.fill('input[name="password"]', 'Password123');
      await page.fill('input[name="confirmPassword"]', 'DifferentPassword');
      await page.fill('input[name="tenantSlug"]', 'test-org');
      await page.click('button[type="submit"]');

      // Should show password mismatch error
      await expect(page.locator('text=/passwords.*match/i, text=/رمز.*مطابقت/i')).toBeVisible({
        timeout: 5000,
      });
    });

    test('باید رمز عبور کوتاه را رد کند', async ({ page }) => {
      await page.goto('/register');

      // Fill form with short password
      await page.fill('input[name="fullName"]', TEST_USER.fullName);
      await page.fill('input[name="email"]', 'new@test.com');
      await page.fill('input[name="password"]', '123');
      await page.fill('input[name="confirmPassword"]', '123');
      await page.fill('input[name="tenantSlug"]', 'test-org');
      await page.click('button[type="submit"]');

      // Should show password length error
      await expect(page.locator('text=/at least.*6/i, text=/حداقل.*6/i')).toBeVisible({
        timeout: 5000,
      });
    });

    test('باید انتخاب نوع حساب کاربری کار کند', async ({ page }) => {
      await page.goto('/register');

      const roleSelect = page.locator('select[name="role"]');

      // Check default value
      await expect(roleSelect).toHaveValue('CUSTOMER');

      // Change to vendor
      await roleSelect.selectOption('VENDOR');
      await expect(roleSelect).toHaveValue('VENDOR');

      // Check helper text changes
      await expect(page.locator('text=/vendor.*products/i, text=/فروشنده/i')).toBeVisible();
    });

    test('باید لینک ورود به صفحه صحیح هدایت کند', async ({ page }) => {
      await page.goto('/register');

      // Click login link
      await page.click('a[href="/login"]');

      // Should navigate to login page
      await expect(page).toHaveURL(/.*login/);
    });
  });

  test.describe('احراز هویت دو مرحله‌ای - 2FA', () => {
    test('باید صفحه تنظیمات امنیتی وجود داشته باشد', async ({ page }) => {
      // Try to access security settings
      await page.goto('/settings/security');

      // Should either show settings or redirect to login
      const url = page.url();

      if (url.includes('/login')) {
        // Expected - user not authenticated
        await expect(page).toHaveURL(/.*login/);
      } else if (url.includes('/settings')) {
        // User is authenticated - check for 2FA options
        await expect(page.locator('text=/2FA|two.*factor|دو.*مرحله/i')).toBeVisible({
          timeout: 5000,
        });
      }
    });

    test('باید صفحه تایید 2FA در صورت فعال بودن نمایش داده شود', async ({ page }) => {
      // Navigate to 2FA verification page (if exists)
      await page.goto('/auth/2fa/verify');

      const url = page.url();

      // Should either show 2FA form or redirect
      if (url.includes('/2fa')) {
        await expect(
          page.locator('input[name="code"], input[type="text"], input[inputmode="numeric"]')
        ).toBeVisible({ timeout: 5000 });
      } else {
        // Redirected - expected behavior
        expect(url).toMatch(/login|dashboard|home/);
      }
    });
  });

  test.describe('عملکرد و امنیت - Performance & Security', () => {
    test('صفحه ورود باید در کمتر از 3 ثانیه بارگذاری شود', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(3000);
    });

    test('صفحه ثبت‌نام باید در کمتر از 3 ثانیه بارگذاری شود', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/register');
      await page.waitForLoadState('domcontentloaded');
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(3000);
    });

    test('باید فیلد رمز عبور از نوع password باشد', async ({ page }) => {
      await page.goto('/login');

      const passwordInput = page.locator('input[name="password"]');
      await expect(passwordInput).toHaveAttribute('type', 'password');
    });

    test('باید autocomplete برای فیلدها تنظیم شده باشد', async ({ page }) => {
      await page.goto('/login');

      // Email should have autocomplete
      const emailInput = page.locator('input[name="email"]');
      const emailAutocomplete = await emailInput.getAttribute('autocomplete');

      // Password should have autocomplete
      const passwordInput = page.locator('input[name="password"]');
      const passwordAutocomplete = await passwordInput.getAttribute('autocomplete');

      // At least one should have autocomplete set
      expect(emailAutocomplete || passwordAutocomplete).toBeTruthy();
    });
  });

  test.describe('دسترسی‌پذیری - Accessibility', () => {
    test('باید فرم ورود با کیبورد قابل استفاده باشد', async ({ page }) => {
      await page.goto('/login');

      // Tab through form elements
      await page.keyboard.press('Tab');

      // First focusable element should be email or a link
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(['INPUT', 'A', 'BUTTON']).toContain(focusedElement);
    });

    test('باید فیلدها دارای label باشند', async ({ page }) => {
      await page.goto('/login');

      // Check for labels or aria-labels
      const emailInput = page.locator('input[name="email"]');
      const hasLabel =
        (await page.locator('label[for="email"], label:has-text("email")').count()) > 0;
      const hasAriaLabel = await emailInput.getAttribute('aria-label');
      const hasPlaceholder = await emailInput.getAttribute('placeholder');

      // Should have at least one accessibility feature
      expect(hasLabel || hasAriaLabel || hasPlaceholder).toBeTruthy();
    });
  });
});
