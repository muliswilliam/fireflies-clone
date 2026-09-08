import { expect, test } from "@playwright/test";

test("home page lists Meetings with a New meeting call to action", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Firefly Notes");
  await expect(
    page.getByRole("heading", { name: "Meetings", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "New meeting" }).first(),
  ).toBeVisible();
});

test("health route reports the database is reachable", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok", database: "ok" });
});
