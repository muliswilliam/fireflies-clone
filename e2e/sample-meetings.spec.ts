import { expect, test } from "@playwright/test";

import { formatDuration, pluralize } from "../src/lib/format";
import { loadSampleMeetingFixtures } from "../src/lib/sample-meetings/fixture";

// Seeded by e2e/global-setup.ts before the run, exactly as the Docker entrypoint does.
const [, sample] = loadSampleMeetingFixtures();
const durationMs =
  Date.parse(sample.recordingEndedAt) - Date.parse(sample.recordingStartedAt);
const firstSpeaker = sample.speakers.find(
  (speaker) => speaker.id === sample.transcript.utterances[0].speakerId,
)!;

test("Sample Meetings are listed with a Sample badge and fully browsable", async ({
  page,
}) => {
  await page.goto("/");

  const row = page.getByRole("link", { name: sample.title });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Sample");
  await expect(row).toContainText(formatDuration(durationMs));
  await expect(row).toContainText(
    pluralize(sample.speakers.length, "Speaker", "Speakers"),
  );
  await expect(row).toContainText("Ready");

  await row.click();
  await expect(page).toHaveURL(`/meetings/${sample.id}`);
  await expect(
    page.getByRole("heading", { level: 1, name: sample.title }),
  ).toBeVisible();
  await expect(page.getByText("Sample", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Meeting Status" }),
  ).toHaveAttribute("data-status", "ready");

  const utterances = page
    .getByRole("list", { name: "Transcript" })
    .getByRole("listitem");
  await expect(utterances).toHaveCount(sample.transcript.utterances.length);
  await expect(utterances.first()).toContainText(firstSpeaker.name);

  await page.getByRole("tab", { name: "Summary" }).click();
  await expect(page.getByRole("article", { name: "Summary" })).toContainText(
    sample.summary.overview,
  );
  await expect(
    page.getByRole("list", { name: "Key Takeaways" }).getByRole("listitem"),
  ).toHaveCount(sample.summary.keyTakeaways.length);

  await page.getByRole("tab", { name: /Action Items/ }).click();
  await expect(
    page.getByRole("list", { name: "Action Items" }).getByRole("listitem"),
  ).toHaveCount(sample.actionItems.length);

  // Otherwise ordinary: the Export menu is offered like for any ready Meeting.
  await expect(page.getByRole("button", { name: "Export" })).toBeEnabled();
});

test("Sample Meetings can be found by title search", async ({ page }) => {
  const word = sample.title.split(" ")[0];
  await page.goto(`/?q=${encodeURIComponent(word.toLowerCase())}`);

  const row = page.getByRole("link", { name: sample.title });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Sample");
});
