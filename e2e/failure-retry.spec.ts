import { expect, test, type Page } from "@playwright/test";

// These tests rely on E2E_FAULT_INJECTION=1 on the server (set in playwright.config.ts):
// a title marker makes the fake provider for that step fail exactly once, so Retry recovers.

async function recordMeeting(page: Page, title: string) {
  await page.goto("/meetings/new");
  await page.getByRole("textbox", { name: "Title" }).fill(title);
  await page.getByRole("button", { name: "Start recording" }).click();
  await expect(page).toHaveURL(/\/meetings\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Stop recording" }).click();
}

test("a summarizing failure shows the step and reason, keeps the Transcript, and Retry recovers", async ({
  page,
}) => {
  const title = `Playwright retry [fail:summarizing] ${Date.now()}`;
  const statusRequests: number[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/status")) statusRequests.push(Date.now());
  });

  await recordMeeting(page, title);

  // The page polls until the Meeting fails, then shows what broke and where.
  const stepper = page.getByRole("list", { name: "Meeting Status" });
  await expect(stepper).toHaveAttribute("data-status", "failed", {
    timeout: 15_000,
  });
  const failedStep = stepper.getByRole("listitem").filter({
    hasText: "Summarizing",
  });
  await expect(failedStep).toHaveAttribute("aria-current", "step");
  await expect(failedStep).toHaveAttribute("data-step-progress", "failed");
  await expect(
    stepper.getByRole("listitem").filter({ hasText: "Transcribing" }),
  ).toHaveAttribute("data-step-progress", "complete");

  const banner = page.getByRole("alert", { name: "Processing failed" });
  await expect(banner).toContainText("Summarizing failed");
  await expect(banner).toContainText("Injected summarizing failure");
  await expect(page.getByText("Failed", { exact: true })).toBeVisible();

  // Polling stops on a terminal Status: after the poll that saw `failed`, no more requests.
  const failedAt = Date.now();
  await page.waitForTimeout(5_000);
  expect(statusRequests.filter((at) => at > failedAt + 1_000)).toEqual([]);

  // The Transcript survived; the Summary tab explains what is missing.
  await expect(
    page.getByRole("list", { name: "Transcript" }).getByRole("listitem"),
  ).toHaveCount(8);
  await page.getByRole("tab", { name: "Summary" }).click();
  await expect(page.getByText("No Summary yet.")).toBeVisible();

  // The list shows the failed Meeting.
  await page.getByRole("link", { name: "Meetings", exact: true }).click();
  const row = page.getByRole("link", { name: title });
  await expect(row).toContainText("Failed");
  await row.click();

  // Retry resumes at summarizing and the Meeting becomes ready.
  await banner.getByRole("button", { name: "Retry" }).click();
  await expect(stepper).toHaveAttribute("data-status", "ready", {
    timeout: 15_000,
  });
  await expect(banner).toHaveCount(0);
  await page.getByRole("tab", { name: "Summary" }).click();
  await expect(
    page
      .getByRole("article", { name: "Summary" })
      .getByRole("heading", { name: "Overview" }),
  ).toBeVisible();
});

test("a transcribing failure leaves no Transcript, and Retry runs the whole pipeline", async ({
  page,
}) => {
  const title = `Playwright retry [fail:transcribing] ${Date.now()}`;

  await recordMeeting(page, title);

  const stepper = page.getByRole("list", { name: "Meeting Status" });
  await expect(stepper).toHaveAttribute("data-status", "failed", {
    timeout: 15_000,
  });
  await expect(
    stepper.getByRole("listitem").filter({ hasText: "Transcribing" }),
  ).toHaveAttribute("data-step-progress", "failed");
  const banner = page.getByRole("alert", { name: "Processing failed" });
  await expect(banner).toContainText("Transcribing failed");
  await expect(page.getByText("No Transcript yet.")).toBeVisible();

  await banner.getByRole("button", { name: "Retry" }).click();
  await expect(stepper).toHaveAttribute("data-status", "ready", {
    timeout: 15_000,
  });
  await expect(
    page.getByRole("list", { name: "Transcript" }).getByRole("listitem"),
  ).toHaveCount(8);
  await expect(banner).toHaveCount(0);
});
