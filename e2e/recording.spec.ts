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
