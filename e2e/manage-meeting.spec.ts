import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

/** An Instant Meeting is the fastest way to a ready Summary. Returns the Meeting id. */
async function readyInstantMeeting(page: Page, title: string): Promise<string> {
  await page.goto("/meetings/new");
  await page.getByRole("textbox", { name: "Title" }).fill(title);
  await page
    .getByRole("radiogroup", { name: "Duration" })
    .getByRole("radio", { name: "5 min", exact: true })
    .check();
  await page.getByRole("button", { name: "Create Instant Meeting" }).click();
  await expect(page).toHaveURL(/\/meetings\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("list", { name: "Meeting Status" }),
  ).toHaveAttribute("data-status", "ready", { timeout: 15_000 });
  return page.url().split("/").at(-1)!;
}

test("rename a Meeting inline, with validation, and the new title persists", async ({
  page,
}) => {
  const title = `Playwright rename ${Date.now()}`;
  const renamed = `${title} (renamed)`;
  await readyInstantMeeting(page, title);

  await page.getByRole("button", { name: "Rename meeting" }).click();
  const form = page.getByRole("form", { name: "Rename meeting" });
  const input = form.getByRole("textbox", { name: "Meeting title" });
  await expect(input).toHaveValue(title);
  await expect(input).toBeFocused();

  // A blank title is refused inline and nothing is saved.
  await input.fill("   ");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form.getByRole("alert")).toHaveText("Give the Meeting a title");
  await expect(input).toHaveAttribute("aria-invalid", "true");

  // Escape cancels and brings the heading back unchanged.
  await input.press("Escape");
  await expect(
    page.getByRole("heading", { level: 1, name: title }),
  ).toBeVisible();
  await expect(form).toHaveCount(0);

  // Enter saves.
  await page.getByRole("button", { name: "Rename meeting" }).click();
  await input.fill(renamed);
  await input.press("Enter");
  await expect(
    page.getByRole("heading", { level: 1, name: renamed }),
  ).toBeVisible();
  await expect(page).toHaveTitle(new RegExp(renamed.replace(/[()]/g, "\\$&")));

  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: renamed }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Meetings", exact: true }).click();
  await expect(page.getByRole("link", { name: renamed })).toBeVisible();
  await expect(
    page.getByRole("link", { name: title, exact: true }),
  ).toHaveCount(0);
});

test("delete a Meeting after confirming, and it is gone from the list", async ({
  page,
}) => {
  const title = `Playwright delete ${Date.now()}`;
  const id = await readyInstantMeeting(page, title);

  await page.getByRole("button", { name: "Delete" }).click();
  const dialog = page.getByRole("alertdialog", {
    name: "Delete this Meeting?",
  });
  await expect(dialog).toContainText(
    "Speakers, Transcript, Summary and Action Items",
  );

  // Cancel keeps everything.
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 1, name: title }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Delete" }).click();
  await dialog.getByRole("button", { name: "Delete" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Meetings" })).toBeVisible();
  await expect(page.getByRole("link", { name: title })).toHaveCount(0);

  const response = await page.goto(`/meetings/${id}`);
  expect(response?.status()).toBe(404);
  const status = await page.request.get(`/api/meetings/${id}/status`);
  expect(status.status()).toBe(404);
});

test.describe("export", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("copy the Summary as Markdown to the clipboard, and download it as a file", async ({
    page,
  }) => {
    const title = `Playwright export ${Date.now()}`;
    await readyInstantMeeting(page, title);

    const exportButton = page.getByRole("button", { name: "Export" });
    await expect(exportButton).toBeEnabled();
    await exportButton.click();
    await page.getByRole("menuitem", { name: "Copy as Markdown" }).click();

    // Base UI announces a toast as a dialog named by its title.
    const toast = page.getByRole("dialog", { name: "Summary copied" });
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("on your clipboard");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain(`# ${title}\n`);
    expect(copied).toContain("## Overview\n");
    expect(copied).toContain("## Key Takeaways\n");
    expect(copied).toContain("## Action Items\n");
    expect(copied).toMatch(
      /^- \[ \] .+ \((Amara Okafor|Ben Liu|Chloe Martin)/m,
    );

    await exportButton.click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("menuitem", { name: "Download .md" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe(
      `${title.toLowerCase().replaceAll(" ", "-")}.md`,
    );
    expect(await readFile(await download.path(), "utf8")).toBe(copied);
  });

  test("export is disabled until the Summary is ready", async ({ page }) => {
    await page.goto("/meetings/new");
    await page
      .getByRole("textbox", { name: "Title" })
      .fill(`Playwright export pending ${Date.now()}`);
    await page.getByRole("button", { name: "Start recording" }).click();
    await expect(page).toHaveURL(/\/meetings\/[0-9a-f-]{36}$/);

    const exportButton = page.getByRole("button", { name: "Export" });
    await expect(exportButton).toBeDisabled();
    await expect(
      page.getByTitle("Available once the Summary is ready"),
    ).toBeVisible();
    await expect(exportButton).toHaveAttribute(
      "aria-description",
      "Available once the Summary is ready",
    );
  });
});
