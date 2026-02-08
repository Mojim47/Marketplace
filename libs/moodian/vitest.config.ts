import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: path.resolve(__dirname),
    include: ['**/*.test.ts', '**/*.property.test.ts'],
    testTimeout: 30000, // 30s for property-based tests with QR generation
    hookTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.property.test.ts', 'src/index.ts'],
    },
  },
  resolve: {
    alias: {
      '@nextgen/prisma': path.resolve(__dirname, '../prisma'),
    },
  },
});

