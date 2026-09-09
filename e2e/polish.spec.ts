import { expect, test } from "@playwright/test";

import { loadSampleMeetingFixtures } from "../src/lib/sample-meetings/fixture";

// Seeded by e2e/global-setup.ts before the run.
const [sample] = loadSampleMeetingFixtures();

test("a page that throws shows the error boundary, with the header still in place", async ({
  page,
}) => {
  // E2E_FAULT_INJECTION lets this search make the list page throw (src/lib/ai/fault-injection.ts).
  await page.goto("/?q=%5Bfail%3Apage%5D");

  await expect(
    page.getByRole("heading", { name: "Something went wrong" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Firefly Notes" })).toBeVisible();

  await page.getByRole("link", { name: "Back to meetings" }).click();
  await expect(
    page.getByRole("heading", { name: "Meetings", exact: true }),
  ).toBeVisible();
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const [name, path] of [
    ["the list", "/"],
    ["the New meeting form", "/meetings/new"],
    ["a Meeting", `/meetings/${sample.id}`],
  ] as const) {
    test(`${name} fits the viewport with no horizontal overflow`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();

      const widths = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(widths.scroll).toBeLessThanOrEqual(widths.client);
    });
  }
});
