import { expect, test } from "@playwright/test";

test("create a Meeting from the prefilled form and see it in the list", async ({
  page,
}) => {
  const title = `Playwright sync ${Date.now()}`;

  await page.goto("/");
  await page.getByRole("link", { name: "New meeting" }).first().click();
  await expect(page).toHaveURL(/\/meetings\/new$/);

  const titleInput = page.getByRole("textbox", { name: "Title" });
  await expect(titleInput).not.toHaveValue("");
  await expect(
    page.getByRole("textbox", { name: "Speaker 1" }),
  ).not.toHaveValue("");
  await titleInput.fill(title);
  await page.getByRole("button", { name: "Start recording" }).click();

  await expect(page).toHaveURL(/\/meetings\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { level: 1, name: title }),
  ).toBeVisible();
  const recordingStep = page
    .getByRole("list", { name: "Meeting Status" })
    .getByRole("listitem")
    .filter({ hasText: "Recording" });
  await expect(recordingStep).toHaveAttribute("aria-current", "step");
  await expect(page.getByText("Amara Okafor")).toBeVisible();

  await page.getByRole("link", { name: "Meetings", exact: true }).click();
  await expect(page).toHaveURL("/");
  const row = page.getByRole("link", { name: title });
  await expect(row).toBeVisible();
  await expect(row).toContainText("3 Speakers");
  await expect(row).toContainText("Recording");

  const search = page.getByRole("searchbox", { name: "Search meetings" });
  await search.fill(title.toUpperCase());
  await search.press("Enter");
  await expect(page).toHaveURL(/\?q=/);
  await expect(page.getByRole("link", { name: title })).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Meetings" }).getByRole("listitem"),
  ).toHaveCount(1);
});

test("shows an empty state when no Meeting matches the search", async ({
  page,
}) => {
  await page.goto("/?q=no-meeting-will-ever-have-this-title");

  await expect(
    page.getByRole("heading", { name: /No meetings match/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "clear the search" }),
  ).toBeVisible();
});

test("shows inline validation errors from the form", async ({ page }) => {
  await page.goto("/meetings/new");

  await page.getByRole("textbox", { name: "Title" }).fill("   ");
  await page.getByRole("textbox", { name: "Speaker 2" }).fill("Amara Okafor");
  await page.getByRole("button", { name: "Start recording" }).click();

  await expect(page.getByText("Give the Meeting a title")).toBeVisible();
  await expect(page.getByText("Speaker names must be unique")).toBeVisible();
  await expect(page).toHaveURL(/\/meetings\/new$/);
});

test("removing Speakers stops at two and adding stops at six", async ({
  page,
}) => {
  await page.goto("/meetings/new");

  await page.getByRole("button", { name: "Remove Speaker 3" }).click();
  await expect(
    page.getByRole("button", { name: "Remove Speaker 1" }),
  ).toBeDisabled();

  const add = page.getByRole("button", { name: "Add Speaker" });
  for (let i = 0; i < 4; i++) await add.click();
  await expect(page.getByRole("textbox", { name: "Speaker 6" })).toBeVisible();
  await expect(add).toBeDisabled();
});

test("unknown Meeting id shows a not found page", async ({ page }) => {
  const response = await page.goto(
    "/meetings/00000000-0000-4000-8000-000000000000",
  );

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Meeting not found" }),
  ).toBeVisible();
});
