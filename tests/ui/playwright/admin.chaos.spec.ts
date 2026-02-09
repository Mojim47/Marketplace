import { test, expect } from "@playwright/test";

const authCookie = {
  name: "admin-token",
  value: "test",
  domain: "localhost",
  path: "/",
};

test.describe("admin chaos ux", () => {
  test("dashboard renders during api failures", async ({ page }) => {
    await page.context().addCookies([authCookie]);
    await page.route("**/api/**", (route) =>
      route.fulfill({ status: 500, body: "{}", contentType: "application/json" }),
    );
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /پنل/ })).toBeVisible();
  });
});
