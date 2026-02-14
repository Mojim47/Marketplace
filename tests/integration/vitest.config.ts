import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: path.resolve(__dirname),
    include: ['**/*.test.ts', '**/*.property.test.ts', '**/*.spec.ts'],
    exclude: ['**/marketplace/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@libs/pricing': path.resolve(__dirname, '../../libs/pricing/src'),
      '@libs/credit': path.resolve(__dirname, '../../libs/credit/src'),
      '@libs/cheque': path.resolve(__dirname, '../../libs/cheque/src'),
      '@libs/workflow': path.resolve(__dirname, '../../libs/workflow/src'),
      '@libs/ledger': path.resolve(__dirname, '../../libs/ledger/src'),
      '@libs/audit': path.resolve(__dirname, '../../libs/audit/src'),
      '@libs/proforma': path.resolve(__dirname, '../../libs/proforma/src'),
      '@libs/dashboard': path.resolve(__dirname, '../../libs/dashboard/src'),
      '@libs/bulk': path.resolve(__dirname, '../../libs/bulk/src'),
      '@nextgen/prisma': path.resolve(__dirname, '../../libs/prisma'),
      '@nextgen/order': path.resolve(__dirname, '../../libs/order/src'),
      '@nextgen/product': path.resolve(__dirname, '../../libs/product/src'),
      '@nextgen/rma': path.resolve(__dirname, '../../libs/rma/src'),
      '@nextgen/cache': path.resolve(__dirname, '../../libs/cache/src'),
    },
  },
});
