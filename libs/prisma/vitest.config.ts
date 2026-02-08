// ═══════════════════════════════════════════════════════════════════════════
// Vitest Configuration - Prisma Library (Backend-only)
// ═══════════════════════════════════════════════════════════════════════════

import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@nextgen/prisma': path.resolve(__dirname, 'src'),
    },
  },

  test: {
    root: __dirname,
    environment: 'node', // Backend tests don't need jsdom
    globals: true,

    // Test Files
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],

    // Coverage Configuration
    coverage: {
      provider: 'v8',
      enabled: true,
      reporter: ['text', 'text-summary'],
      reportsDirectory: './coverage',

      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/*.d.ts', '**/index.ts'],
    },

    // Timeouts
    testTimeout: 60000,
    hookTimeout: 30000,
  },
});
