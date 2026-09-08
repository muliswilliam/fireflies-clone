import { expect, test } from "@playwright/test";

test("home page loads with the Firefly Notes empty state", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Firefly Notes");
  await expect(
    page.getByRole("heading", { name: "Firefly Notes" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No meetings yet" }),
  ).toBeVisible();
});

test("health route reports the database is reachable", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok", database: "ok" });
});
