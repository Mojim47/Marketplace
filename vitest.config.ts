// ═══════════════════════════════════════════════════════════════════════════
// Vitest Configuration - NextGen Marketplace
// ═══════════════════════════════════════════════════════════════════════════

import path from 'node:path';
import { defineConfig } from 'vitest/config';

const coverageScope = process.env.COVERAGE_SCOPE;
const skipHeavyTests = process.env.SKIP_ONNX_PRISMA === 'true';
const relaxCoverage = process.env.RELAX_COVERAGE === 'true';
const testInclude =
  coverageScope === 'aiar'
    ? [
        'libs/ai/src/**/*.{test,spec}.{ts,tsx}',
        'libs/ar/src/**/*.{test,spec}.{ts,tsx}',
        'apps/api/src/search/**/*.{test,spec}.{ts,tsx}',
      ]
    : [
        'libs/**/src/**/*.{test,spec}.{ts,tsx}',
        'libs/**/test/**/*.{test,spec}.{ts,tsx}',
        'apps/**/src/**/*.{test,spec}.{ts,tsx}',
        'apps/**/test/**/*.{test,spec}.{ts,tsx}',
        'tests/**/*.{test,spec}.{ts,tsx}',
      ];
const coverageInclude =
  coverageScope === 'aiar'
    ? [
        'libs/ai/src/**/*.{ts,tsx}',
        'libs/ar/src/ARViewer.tsx',
        'apps/api/src/search/ai-search.service.ts',
      ]
    : ['libs/**/src/**/*.{ts,tsx}', 'apps/**/src/**/*.{ts,tsx}'];

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
      '@nextgen/sc3': path.resolve(__dirname, 'libs/sc3/src'),
      '@': path.resolve(__dirname, 'src'),
    },
  },

  test: {
    // Environment
    root: __dirname,
    environment: 'jsdom',
    globals: true,

    // Setup
    setupFiles: ['./vitest.setup.ts'],

    // Test Files
    include: testInclude,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/out/**',
      '**/coverage/**',
      '**/*.config.*',
      // Exclude Playwright E2E/visual specs from Vitest (they run with Playwright runner)
      'tests/ui/playwright/**',
      // Temporary skips to unblock pre-push when heavy deps are absent (models/DB/prisma)
      ...(skipHeavyTests
        ? [
            'libs/ai/src/embeddings/onnx-embedder.test.ts',
            'apps/api/src/search/ai-search.embedding.test.ts',
            'tests/integration/orders-lock.integration.test.ts',
            'apps/worker/src/worker.controller.spec.ts',
            'apps/api/src/auth/auth.service.spec.ts',
          ]
        : []),
    ],

    // Coverage Configuration
    coverage: {
      provider: 'v8',
      enabled: true,
      reporter: ['text', 'text-summary', 'lcov', 'html', 'json-summary'],
      reportsDirectory: './coverage',

      include: coverageInclude,
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/*.d.ts',
        '**/*.config.{ts,js}',
        '**/node_modules/**',
        '**/dist/**',
        '**/.next/**',
        '**/coverage/**',
        '**/index.ts',
        '**/*.type.ts',
        '**/*.interface.ts',
        '**/*.enum.ts',
        'ops/**',
        'scripts/**',
        'check-ready.js',
        // Native binding wrapper (onnxruntime) is validated via integration; exclude from unit coverage aggregation.
        'libs/ai/src/embeddings/onnx-embedder.ts',
      ],

      // When RELAX_COVERAGE=true, disable "all" instrumentation and thresholds.
      all: !relaxCoverage,
      clean: true,

      // Coverage thresholds - standard baseline (can be relaxed via env)
      thresholds: relaxCoverage
        ? undefined
        : coverageScope === 'aiar'
          ? {
              statements: 85,
              branches: 60,
              functions: 80,
              lines: 85,
            }
          : {
              statements: 80,
              branches: 75,
              functions: 70,
              lines: 80,
            },
    },

    // Performance
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
    maxConcurrency: 5,

    // Output
    reporters: ['default', 'verbose'],
    outputFile: {
      html: './coverage/index.html',
      json: './coverage/coverage.json',
    },

    // Timeouts
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
