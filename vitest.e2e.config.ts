import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@nextgen/queue': path.resolve(__dirname, 'libs/queue/src'),
      '@nextgen/moodian': path.resolve(__dirname, 'libs/moodian/src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['apps/api/test/payment-moodian.e2e-spec.ts'],
    exclude: [],
    coverage: {
      enabled: false,
    },
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    testTimeout: 120000,
    hookTimeout: 120000,
  },
});
