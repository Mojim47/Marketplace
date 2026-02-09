import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { target: 'node18' },
  test: {
    globals: true,
    environment: 'node',
    root: path.resolve(__dirname),
    include: ['src/**/*.test.ts', 'src/**/*.property.test.ts'],
    exclude: ['node_modules', 'dist'],
    setupFiles: [],
    testTimeout: 30000,
    hookTimeout: 30000,
    passWithNoTests: true,
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});
