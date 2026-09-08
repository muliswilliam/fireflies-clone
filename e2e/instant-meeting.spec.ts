import { expect, test } from "@playwright/test";

test("create an Instant Meeting and reach Ready", async ({ page }) => {
  const title = `Playwright instant ${Date.now()}`;

  await page.goto("/meetings/new");
  await page.getByRole("textbox", { name: "Title" }).fill(title);

  // The Instant Meeting affordance sits alongside Start, with 30 minutes preselected.
  const durations = page.getByRole("radiogroup", { name: "Duration" });
  for (const minutes of [5, 15, 30, 60]) {
    await expect(
      durations.getByRole("radio", { name: `${minutes} min`, exact: true }),
    ).toBeVisible();
  }
  await expect(
    durations.getByRole("radio", { name: "30 min", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("button", { name: "Start recording" }),
  ).toBeVisible();

  await durations.getByRole("radio", { name: "5 min", exact: true }).check();
  await page.getByRole("button", { name: "Create Instant Meeting" }).click();
  await expect(page).toHaveURL(/\/meetings\/[0-9a-f-]{36}$/);

  // No Recording to sit through: the stepper is already past it and there is nothing to stop.
  const stepper = page.getByRole("list", { name: "Meeting Status" });
  await expect(
    stepper.getByRole("listitem").filter({ hasText: "Recording" }),
  ).toHaveAttribute("data-step-progress", "complete");
  await expect(
    page.getByRole("button", { name: "Stop recording" }),
  ).toHaveCount(0);
  await expect(page.getByRole("timer")).toHaveCount(0);

  // Processing was scheduled by the create action; the page polls until the Meeting is ready.
  await expect(stepper).toHaveAttribute("data-status", "ready", {
    timeout: 15_000,
  });

  // The detail page shows the chosen duration, and the Transcript is sized to it: 5 min / 12 s.
  const header = page.locator("header").filter({ hasText: title });
  await expect(header).toContainText("5 min");
  await expect(header).toContainText("3 Speakers");
  await expect(
    page.getByRole("list", { name: "Transcript" }).getByRole("listitem"),
  ).toHaveCount(25);
  await page.getByRole("tab", { name: "Summary" }).click();
  await expect(
    page
      .getByRole("article", { name: "Summary" })
      .getByRole("heading", { name: "Overview" }),
  ).toBeVisible();

  // The list shows it like any other Meeting, with the duration.
  await page.getByRole("link", { name: "Meetings", exact: true }).click();
  const row = page.getByRole("link", { name: title });
  await expect(row).toContainText("Ready");
  await expect(row).toContainText("5 min");
  await expect(row).toContainText("3 Speakers");
});

test("an Instant Meeting is validated like a live one", async ({ page }) => {
  await page.goto("/meetings/new");

  await page.getByRole("textbox", { name: "Title" }).fill("   ");
  await page.getByRole("button", { name: "Create Instant Meeting" }).click();

  await expect(page.getByText("Give the Meeting a title")).toBeVisible();
  await expect(page).toHaveURL(/\/meetings\/new$/);
});
