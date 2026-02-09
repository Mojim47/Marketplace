import { defineConfig } from '@playwright/test';

const reuseExistingServer = Boolean(process.env.UI_SERVER_ALREADY_RUNNING);

export default defineConfig({
  testDir: 'tests/ui/playwright',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['list'], ['junit', { outputFile: 'test-results/ui-playwright.xml' }]]
    : [['list']],
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm --filter @nextgen/web start',
      url: 'http://localhost:3000/livez',
      reuseExistingServer,
      timeout: 120000,
      env: {
        ...process.env,
        PORT: '3000',
        CSP_API_DOMAIN: process.env.CSP_API_DOMAIN ?? 'api.example.com',
        CSP_CDN_DOMAIN: process.env.CSP_CDN_DOMAIN ?? 'cdn.example.com',
        CSP_ANALYTICS_DOMAIN: process.env.CSP_ANALYTICS_DOMAIN ?? 'analytics.example.com',
      },
    },
    {
      command: 'pnpm --filter @nextgen/admin start',
      url: 'http://localhost:3003/livez',
      reuseExistingServer,
      timeout: 120000,
      env: {
        ...process.env,
        PORT: '3003',
        ADMIN_DISABLE_AUTH_MIDDLEWARE: 'true',
        AUTH_MODE: 'mock',
        ALLOW_AUTH_MOCK: 'true',
        CSP_API_DOMAIN: process.env.CSP_API_DOMAIN ?? 'api.example.com',
        CSP_CDN_DOMAIN: process.env.CSP_CDN_DOMAIN ?? 'cdn.example.com',
        CSP_ANALYTICS_DOMAIN: process.env.CSP_ANALYTICS_DOMAIN ?? 'analytics.example.com',
      },
    },
  ],
  projects: [
    {
      name: 'web',
      testMatch: /.*web\..*\.spec\.ts/,
      use: {
        baseURL: 'http://localhost:3000',
      },
    },
    {
      name: 'admin',
      testMatch: /.*admin\..*\.spec\.ts/,
      use: {
        baseURL: 'http://localhost:3003',
      },
    },
  ],
});
