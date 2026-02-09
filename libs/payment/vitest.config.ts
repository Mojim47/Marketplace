import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: resolve(__dirname),
    include: ['test/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 30000,
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@nextgen/errors': resolve(__dirname, '../errors/src'),
      '@nextgen/auth': resolve(__dirname, '../auth/src'),
      '@nextgen/validation': resolve(__dirname, '../validation/src'),
      '@nextgen/prisma': resolve(__dirname, '../prisma/src'),
    },
  },
});
