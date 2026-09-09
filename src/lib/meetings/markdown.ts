import {
  formatDateTime,
  formatDuration,
  recordingDurationMs,
} from "@/lib/format";

import type { Meeting } from "./service";
import type { Summary } from "./summary";

/** What `exportSummaryMarkdown` hands to a client: the document and a filename to save it under. */
export type SummaryExport = {
  filename: string;
  markdown: string;
};

/**
 * Renders a Meeting's Summary as a Markdown document: the title, a meta line, then the
 * Overview, Key Takeaways and Action Items under their own headings. Action Items are a
 * task list carrying the owner's name, the due date and the done state.
 */
export function summaryMarkdown(
  meeting: Meeting & { summary: Summary },
): string {
  const speakerNames = new Map(
    meeting.speakers.map((speaker) => [speaker.id, speaker.name]),
  );
  const durationMs = recordingDurationMs(meeting);
  const meta = [
    formatDateTime(meeting.recordingStartedAt),
    durationMs === null ? null : formatDuration(durationMs),
    `Speakers: ${meeting.speakers.map((speaker) => speaker.name).join(", ")}`,
  ]
    .filter((part) => part !== null)
    .join(" · ");

  const actionItems =
    meeting.actionItems.length === 0
      ? ["_No Action Items._"]
      : meeting.actionItems.map((item) => {
          const owner =
            item.ownerSpeakerId === null
              ? null
              : (speakerNames.get(item.ownerSpeakerId) ?? null);
          const details = [
            owner,
            item.dueDate === null ? null : `due ${item.dueDate}`,
          ].filter((part) => part !== null);
          const suffix = details.length > 0 ? ` (${details.join(", ")})` : "";
          return `- [${item.done ? "x" : " "}] ${singleLine(item.text)}${suffix}`;
        });

  return [
    `# ${singleLine(meeting.title)}`,
    "",
    meta,
    "",
    "## Overview",
    "",
    singleLine(meeting.summary.overview),
    "",
    "## Key Takeaways",
    "",
    ...meeting.summary.keyTakeaways.map(
      (takeaway) => `- ${singleLine(takeaway)}`,
    ),
    "",
    "## Action Items",
    "",
    ...actionItems,
    "",
  ].join("\n");
}

const MAX_FILENAME_STEM_LENGTH = 80;

/** "Q3 roadmap sync" becomes "q3-roadmap-sync.md"; a title with nothing usable falls back to a generic name. */
export function summaryMarkdownFilename(title: string): string {
  const stem = title
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_FILENAME_STEM_LENGTH)
    .replace(/-+$/, "");
  return `${stem.length > 0 ? stem : "meeting-summary"}.md`;
}

/** Keeps a list item on one line: Markdown would otherwise break the item or start a paragraph. */
function singleLine(text: string): string {
  return text.replace(/\s*\n\s*/g, " ").trim();
}
