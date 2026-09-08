import { expect, test } from "@playwright/test";

test("record, stop, and read the Transcript", async ({ page }) => {
  const title = `Playwright recording ${Date.now()}`;

  await page.goto("/meetings/new");
  await page.getByRole("textbox", { name: "Title" }).fill(title);
  await page.getByRole("button", { name: "Start recording" }).click();
  await expect(page).toHaveURL(/\/meetings\/[0-9a-f-]{36}$/);

  // The recording view: a running timer, a pulsing indicator and a Stop button.
  const timer = page.getByRole("timer", { name: "Recording time" });
  await expect(timer).toHaveText(/^\d{2}:\d{2}$/);
  const firstReading = (await timer.textContent()) ?? "";
  await expect(timer).not.toHaveText(firstReading, { timeout: 5_000 });
  await expect(page.getByTestId("recording-indicator")).toBeVisible();

  await page.getByRole("button", { name: "Stop recording" }).click();

  // Processing runs after the response; the page polls until the Meeting is ready.
  const stepper = page.getByRole("list", { name: "Meeting Status" });
  await expect(stepper).toHaveAttribute("data-status", "ready", {
    timeout: 15_000,
  });
  const statusResponse = await page.request.get(
    `/api/meetings/${page.url().split("/").at(-1)}/status`,
  );
  expect(await statusResponse.json()).toEqual({
    status: "ready",
    failedStep: null,
  });
  await expect(
    page.getByRole("button", { name: "Stop recording" }),
  ).toHaveCount(0);

  // The Transcript tab shows Utterances attributed to the Meeting's Speakers.
  await expect(page.getByRole("tab", { name: "Transcript" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const transcript = page.getByRole("list", { name: "Transcript" });
  const utterances = transcript.getByRole("listitem");
  await expect(utterances).toHaveCount(8);
  for (const name of ["Amara Okafor", "Ben Liu", "Chloe Martin"]) {
    await expect(transcript.getByText(name).first()).toBeVisible();
  }

  // Clicking a timestamp highlights that Utterance.
  const second = utterances.nth(1);
  await expect(second).not.toHaveAttribute("data-highlighted", "true");
  await second.getByRole("button", { name: /Highlight Utterance at/ }).click();
  await expect(second).toHaveAttribute("data-highlighted", "true");
  await expect(utterances.first()).not.toHaveAttribute(
    "data-highlighted",
    "true",
  );

  // The Summary tab: an Overview about this Meeting and its Key Takeaways.
  await page.getByRole("tab", { name: "Summary" }).click();
  const summary = page.getByRole("article", { name: "Summary" });
  await expect(
    summary.getByRole("heading", { name: "Overview" }),
  ).toBeVisible();
  await expect(summary).toContainText(title);
  const takeaways = summary
    .getByRole("list", { name: "Key Takeaways" })
    .getByRole("listitem");
  expect(await takeaways.count()).toBeGreaterThanOrEqual(3);

  // The Action Items tab: toggle one done, and it stays done after a reload.
  await page.getByRole("tab", { name: /Action Items/ }).click();
  const items = page
    .getByRole("list", { name: "Action Items" })
    .getByRole("listitem");
  expect(await items.count()).toBeGreaterThanOrEqual(2);
  await expect(items.first()).toContainText(
    /Amara Okafor|Ben Liu|Chloe Martin/,
  );
  const firstCheckbox = items.first().getByRole("checkbox");
  await expect(firstCheckbox).not.toBeChecked();
  await firstCheckbox.click();
  await expect(firstCheckbox).toBeChecked();
  await expect(items.first()).toHaveAttribute("data-done", "true");
  await expect(items.nth(1)).not.toHaveAttribute("data-done", "true");
  // The tick shows optimistically; the checkbox is disabled until the server has saved it.
  await expect(firstCheckbox).toBeEnabled();

  await page.reload();
  await page.getByRole("tab", { name: /Action Items/ }).click();
  await expect(items.first().getByRole("checkbox")).toBeChecked();
  await expect(items.nth(1).getByRole("checkbox")).not.toBeChecked();

  // Regenerating warns that done state is lost, runs summarizing again, and resets it.
  await page.getByRole("tab", { name: "Summary" }).click();
  await page.getByRole("button", { name: "Regenerate" }).click();
  const dialog = page.getByRole("alertdialog", {
    name: "Regenerate the Summary?",
  });
  await expect(dialog).toContainText(/marked done is lost/);
  await dialog.getByRole("button", { name: "Regenerate" }).click();
  await expect(stepper).toHaveAttribute("data-status", "ready", {
    timeout: 15_000,
  });
  await page.getByRole("tab", { name: /Action Items/ }).click();
  await expect(items.first().getByRole("checkbox")).not.toBeChecked();

  // The list shows the finished Meeting with its duration.
  await page.getByRole("link", { name: "Meetings", exact: true }).click();
  const row = page.getByRole("link", { name: title });
  await expect(row).toContainText("Ready");
  await expect(row).toContainText(/\d+ s/);
});

test("status route 404s for an unknown Meeting", async ({ request }) => {
  const missing = await request.get(
    "/api/meetings/00000000-0000-4000-8000-000000000000/status",
  );
  expect(missing.status()).toBe(404);
});
