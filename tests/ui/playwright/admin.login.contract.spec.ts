import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const contractPath = path.join(process.cwd(), 'contracts', 'ui', 'admin-login.contract.json');
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf-8')) as {
  routes: string[];
  requiredTestIds: Record<string, string[]>;
};

test.describe('admin login contract', () => {
  for (const route of contract.routes) {
    test(`${route} matches contract`, async ({ page }) => {
      await page.goto(route);
      const required = contract.requiredTestIds[route] ?? [];
      for (const testId of required) {
        await expect(page.getByTestId(testId)).toBeVisible();
      }
    });
  }
});
