import { describe, expect, it } from "vitest";

import { formatDateTime } from "@/lib/format";
import {
  summaryMarkdown,
  summaryMarkdownFilename,
} from "@/lib/meetings/markdown";
import type { Meeting } from "@/lib/meetings/service";

const MEETING_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AMARA = "11111111-1111-4111-8111-111111111111";
const BEN = "22222222-2222-4222-8222-222222222222";
const START = new Date("2026-09-08T10:00:00.000Z");

function meeting(overrides: Partial<Meeting> = {}): Meeting & {
  summary: NonNullable<Meeting["summary"]>;
} {
  return {
    id: MEETING_ID,
    title: "Q3 roadmap sync",
    status: "ready",
    failedStep: null,
    errorMessage: null,
    agenda: null,
    isSample: false,
    isInstant: false,
    recordingStartedAt: START,
    recordingEndedAt: new Date(START.getTime() + 32 * 60_000),
    transcript: { utterances: [] },
    summary: {
      overview: "The team agreed the Q3 roadmap.",
      keyTakeaways: ["Ship the beta first", "Delay the redesign", "Hire one"],
    },
    createdAt: START,
    updatedAt: START,
    speakers: [
      { id: AMARA, meetingId: MEETING_ID, name: "Amara", position: 0 },
      { id: BEN, meetingId: MEETING_ID, name: "Ben", position: 1 },
    ],
    actionItems: [
      {
        id: "a1",
        meetingId: MEETING_ID,
        ownerSpeakerId: AMARA,
        text: "Draft the beta announcement",
        dueDate: "Friday",
        done: false,
        position: 0,
      },
      {
        id: "a2",
        meetingId: MEETING_ID,
        ownerSpeakerId: BEN,
        text: "Confirm the numbers",
        dueDate: null,
        done: true,
        position: 1,
      },
      {
        id: "a3",
        meetingId: MEETING_ID,
        ownerSpeakerId: null,
        text: "Book the review",
        dueDate: "Next Tuesday",
        done: false,
        position: 2,
      },
      {
        id: "a4",
        meetingId: MEETING_ID,
        ownerSpeakerId: null,
        text: "Tidy the backlog",
        dueDate: null,
        done: false,
        position: 3,
      },
    ],
    ...overrides,
  } as Meeting & { summary: NonNullable<Meeting["summary"]> };
}

describe("summaryMarkdown", () => {
  it("writes the title, a meta line, and a section per part of the Summary", () => {
    expect(summaryMarkdown(meeting())).toBe(
      [
        "# Q3 roadmap sync",
        "",
        `${formatDateTime(START)} · 32 min · Speakers: Amara, Ben`,
        "",
        "## Overview",
        "",
        "The team agreed the Q3 roadmap.",
        "",
        "## Key Takeaways",
        "",
        "- Ship the beta first",
        "- Delay the redesign",
        "- Hire one",
        "",
        "## Action Items",
        "",
        "- [ ] Draft the beta announcement (Amara, due Friday)",
        "- [x] Confirm the numbers (Ben)",
        "- [ ] Book the review (due Next Tuesday)",
        "- [ ] Tidy the backlog",
        "",
      ].join("\n"),
    );
  });

  it("says so when the Meeting produced no Action Items", () => {
    const markdown = summaryMarkdown(meeting({ actionItems: [] }));

    expect(markdown).toContain("## Action Items\n\n_No Action Items._\n");
  });

  it("leaves the duration out while the Recording has not ended", () => {
    const markdown = summaryMarkdown(meeting({ recordingEndedAt: null }));

    expect(markdown).toContain(
      `${formatDateTime(START)} · Speakers: Amara, Ben`,
    );
  });

  it("names an owner the Meeting no longer knows as nobody", () => {
    const markdown = summaryMarkdown(
      meeting({
        speakers: [
          { id: BEN, meetingId: MEETING_ID, name: "Ben", position: 1 },
        ],
      }),
    );

    expect(markdown).toContain(
      "- [ ] Draft the beta announcement (due Friday)",
    );
  });

  it("keeps a multi-line Overview as one paragraph", () => {
    const markdown = summaryMarkdown(
      meeting({
        summary: {
          overview: "First sentence.\nSecond sentence.",
          keyTakeaways: ["a", "b", "c"],
        },
      }),
    );

    expect(markdown).toContain(
      "## Overview\n\nFirst sentence. Second sentence.\n",
    );
  });
});

describe("summaryMarkdownFilename", () => {
  it("slugs the title and adds the extension", () => {
    expect(summaryMarkdownFilename("Q3 roadmap sync")).toBe(
      "q3-roadmap-sync.md",
    );
    expect(summaryMarkdownFilename("  Design / Review: v2!  ")).toBe(
      "design-review-v2.md",
    );
  });

  it("falls back to a generic name when nothing survives the slug", () => {
    expect(summaryMarkdownFilename("???")).toBe("meeting-summary.md");
  });

  it("caps very long titles", () => {
    const filename = summaryMarkdownFilename("word ".repeat(40));

    expect(filename.length).toBeLessThanOrEqual(80 + ".md".length);
    expect(filename.endsWith(".md")).toBe(true);
    expect(filename).not.toContain("-.md");
  });
});
