// â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
// Vitest Property-Based Testing Configuration - NextGen Marketplace
// â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
// Dark Level Configuration: 10,000 iterations for financial logic
// State Machine Testing for critical operations
// â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ

import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@nextgen/ui': path.resolve(__dirname, 'libs/ui/src'),
      '@nextgen/types': path.resolve(__dirname, 'libs/types/src'),
      '@nextgen/auth': path.resolve(__dirname, 'libs/auth/src'),
      '@nextgen/security': path.resolve(__dirname, 'libs/security/src'),
      '@nextgen/admin-core': path.resolve(__dirname, 'libs/admin-core/src'),
      '@nextgen/invoice': path.resolve(__dirname, 'libs/invoice/src'),
      '@nextgen/payment': path.resolve(__dirname, 'libs/payment/src'),
      '@nextgen/fraud': path.resolve(__dirname, 'libs/fraud/src'),
      '@nextgen/ai': path.resolve(__dirname, 'libs/ai/src'),
      '@nextgen/ar': path.resolve(__dirname, 'libs/ar/src'),
      '@nextgen/queue': path.resolve(__dirname, 'libs/queue/src'),
      '@nextgen/storage': path.resolve(__dirname, 'libs/storage/src'),
      '@nextgen/search': path.resolve(__dirname, 'libs/search/src'),
      '@nextgen/cooperation': path.resolve(__dirname, 'libs/cooperation/src'),
      '@nextgen/tax': path.resolve(__dirname, 'libs/tax/src'),
      '@nextgen/testing': path.resolve(__dirname, 'libs/testing/src'),
      '@nextgen/localization': path.resolve(__dirname, 'libs/localization/src'),
      '@nextgen/seeder': path.resolve(__dirname, 'libs/seeder/src'),
      '@nextgen/observability': path.resolve(__dirname, 'libs/observability/src'),
      '@nextgen/cache': path.resolve(__dirname, 'libs/cache/src'),
      '@nextgen/design-system': path.resolve(__dirname, 'libs/design-system/src'),
      '@nextgen/order': path.resolve(__dirname, 'libs/order/src'),
      '@nextgen/config': path.resolve(__dirname, 'libs/config/src'),
      '@nextgen/prisma': path.resolve(__dirname, 'libs/prisma/src'),
      '@libs/order': path.resolve(__dirname, 'libs/order/src'),
      '@': path.resolve(__dirname, 'src'),
    },
  },

  test: {
    // Environment
    root: __dirname,
    environment: 'node',
    globals: true,

    // Setup
    setupFiles: ['./vitest.setup.ts'],

    // Property-Based Test Files ONLY
    include: [
      'libs/**/src/**/*.property.test.{ts,tsx}',
      'libs/**/src/**/*.pbt.test.{ts,tsx}',
      'libs/**/test/**/*.property.test.{ts,tsx}',
      'libs/**/test/**/*.pbt.test.{ts,tsx}',
      'apps/**/src/**/*.property.test.{ts,tsx}',
      'apps/**/test/**/*.property.test.{ts,tsx}',
      'tests/**/*.property.test.{ts,tsx}',
      'tests/**/*.pbt.test.{ts,tsx}',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/out/**',
      '**/coverage/**',
      '**/*.config.*',
    ],

    // â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
    // DARK LEVEL: Extended timeouts for 10,000 iterations
    // Requirements 6.1: testTimeout set to 60000 for property-based tests
    // â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
    testTimeout: 60000, // 60 seconds per test (for 10,000 iterations)
    hookTimeout: 30000, // 30 seconds for setup/teardown

    // Performance - Single thread for deterministic PBT
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // Deterministic execution for PBT
        isolate: true,
      },
    },
    maxConcurrency: 1, // Run PBT tests sequentially

    // Output
    reporters: ['default', 'verbose'],

    // Retry failed tests (PBT may have flaky edge cases)
    retry: 0, // No retry - if PBT fails, it's a real bug

    // Bail on first failure for faster feedback
    bail: 1,

    // Coverage disabled for PBT (focus on correctness, not coverage)
    coverage: {
      enabled: false,
    },
  },

  // â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
  // fast-check Global Configuration
  // â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
  // Note: fast-check numRuns is configured per-test, but we set defaults here
  // via environment variables that tests can read
  define: {
    'import.meta.env.FAST_CHECK_NUM_RUNS': JSON.stringify(10000),
    'import.meta.env.FAST_CHECK_VERBOSE': JSON.stringify(true),
    'import.meta.env.FAST_CHECK_SEED': JSON.stringify(Date.now()),
  },
});

