import { expect, test } from "@playwright/test";

// The database is seeded before e2e runs (`pnpm db:seed`, or the Docker entrypoint).
const SAMPLE_TITLE = "Mobile onboarding funnel review";

test("Sample Meetings are listed with a Sample badge and fully browsable", async ({
  page,
}) => {
  await page.goto("/");

  const row = page.getByRole("link", { name: SAMPLE_TITLE });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Sample");
  await expect(row).toContainText("17 min");
  await expect(row).toContainText("3 Speakers");
  await expect(row).toContainText("Ready");

  await row.click();
  await expect(page).toHaveURL(/\/meetings\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { level: 1, name: SAMPLE_TITLE }),
  ).toBeVisible();
  await expect(page.getByText("Sample", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Meeting Status" }),
  ).toHaveAttribute("data-status", "ready");

  const utterances = page
    .getByRole("list", { name: "Transcript" })
    .getByRole("listitem");
  await expect(utterances).toHaveCount(32);
  await expect(utterances.first()).toContainText("Hana Kimura");

  await page.getByRole("tab", { name: "Summary" }).click();
  await expect(page.getByRole("article", { name: "Summary" })).toContainText(
    "sample-data experiment",
  );
  await expect(
    page.getByRole("list", { name: "Key Takeaways" }).getByRole("listitem"),
  ).toHaveCount(5);

  await page.getByRole("tab", { name: /Action Items/ }).click();
  await expect(
    page.getByRole("list", { name: "Action Items" }).getByRole("listitem"),
  ).toHaveCount(5);

  // Otherwise ordinary: the Export menu is offered like for any ready Meeting.
  await expect(page.getByRole("button", { name: "Export" })).toBeEnabled();
});

test("Sample Meetings can be found by title search", async ({ page }) => {
  await page.goto("/?q=postmortem");

  const row = page.getByRole("link", { name: /Postmortem: checkout outage/ });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Sample");
});
