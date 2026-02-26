import { defineConfig } from '@playwright/test';

const forceExternalServer = process.env.UI_SERVER_ALREADY_RUNNING === 'true';
const reuseExistingServer = forceExternalServer || !process.env.CI;
const webPort = process.env.UI_WEB_PORT ?? '37100';
const adminPort = process.env.UI_ADMIN_PORT ?? '37103';
const vendorPort = process.env.UI_VENDOR_PORT ?? '37102';
const webBaseUrl = `http://localhost:${webPort}`;
const vendorBaseUrl = `http://localhost:${vendorPort}`;
const knownProjects = new Set(['web', 'admin', 'vendor']);

function readRequestedProjects(argv: string[]) {
  const requested = new Set<string>();
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current) {
      continue;
    }
    if (current.startsWith('--project=')) {
      const value = current.slice('--project='.length).trim();
      if (knownProjects.has(value)) {
        requested.add(value);
      }
      continue;
    }
    if (current === '--project') {
      const value = argv[index + 1]?.trim();
      if (value && knownProjects.has(value)) {
        requested.add(value);
      }
    }
  }
  if (requested.size === 0) {
    return knownProjects;
  }
  return requested;
}

const requestedProjects = readRequestedProjects(process.argv);
const webStorageState = {
  cookies: [
    {
      name: 'access_token',
      value: 'playwright-e2e-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax' as const,
    },
  ],
  origins: [],
};
const managedServers = [
      ...(requestedProjects.has('web')
        ? [
            {
              command: 'pnpm --filter @nextgen/web dev',
              url: `${webBaseUrl}/livez`,
              reuseExistingServer,
              timeout: 180000,
              env: {
                ...process.env,
                PORT: webPort,
                CSP_API_DOMAIN: process.env.CSP_API_DOMAIN ?? 'api.example.com',
                CSP_CDN_DOMAIN: process.env.CSP_CDN_DOMAIN ?? 'cdn.example.com',
                CSP_ANALYTICS_DOMAIN: process.env.CSP_ANALYTICS_DOMAIN ?? 'analytics.example.com',
              },
            },
          ]
        : []),
      ...(requestedProjects.has('admin')
        ? [
            {
              command: 'pnpm --filter @nextgen/admin dev',
              url: `http://localhost:${adminPort}/livez`,
              reuseExistingServer,
              timeout: 180000,
              env: {
                ...process.env,
                PORT: adminPort,
                ADMIN_DISABLE_AUTH_MIDDLEWARE: 'true',
                AUTH_MODE: 'mock',
                ALLOW_AUTH_MOCK: 'true',
                CSP_API_DOMAIN: process.env.CSP_API_DOMAIN ?? 'api.example.com',
                CSP_CDN_DOMAIN: process.env.CSP_CDN_DOMAIN ?? 'cdn.example.com',
                CSP_ANALYTICS_DOMAIN: process.env.CSP_ANALYTICS_DOMAIN ?? 'analytics.example.com',
              },
            },
          ]
        : []),
      ...(requestedProjects.has('vendor')
        ? [
            {
              command: 'pnpm --filter @nextgen/vendor-portal dev',
              url: `${vendorBaseUrl}/livez`,
              reuseExistingServer,
              timeout: 180000,
              env: {
                ...process.env,
                PORT: vendorPort,
                CSP_API_DOMAIN: process.env.CSP_API_DOMAIN ?? 'api.example.com',
                CSP_CDN_DOMAIN: process.env.CSP_CDN_DOMAIN ?? 'cdn.example.com',
                CSP_ANALYTICS_DOMAIN: process.env.CSP_ANALYTICS_DOMAIN ?? 'analytics.example.com',
              },
            },
          ]
        : []),
    ];

const webServer = forceExternalServer
  ? undefined
  : managedServers.length === 1
    ? managedServers[0]
    : managedServers;

export default defineConfig({
  testDir: 'tests/ui/playwright',
  timeout: 60000,
  expect: {
    timeout: 10000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      maxDiffPixels: 15000,
    },
  },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['list'], ['junit', { outputFile: 'test-results/ui-playwright.xml' }]]
    : [['list']],
  use: {
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  webServer,
  projects: [
    {
      name: 'web',
      testMatch: /.*web\..*\.spec\.ts/,
      use: {
        baseURL: webBaseUrl,
        storageState: webStorageState,
      },
    },
    {
      name: 'admin',
      testMatch: /.*admin\..*\.spec\.ts/,
      use: {
        baseURL: `http://localhost:${adminPort}`,
      },
    },
    {
      name: 'vendor',
      testMatch: /.*vendor\..*\.spec\.ts/,
      use: {
        baseURL: vendorBaseUrl,
      },
    },
  ],
  snapshotPathTemplate: '{testDir}/{testFileName}-snapshots/{arg}-{projectName}{ext}',
});
