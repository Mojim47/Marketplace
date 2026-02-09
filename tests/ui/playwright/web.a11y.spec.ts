import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("web a11y", () => {
  test("home page", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
