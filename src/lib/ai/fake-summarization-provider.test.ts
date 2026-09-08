import { describe, expect, it } from "vitest";

import { createFakeSummarizationProvider } from "@/lib/ai/fake-summarization-provider";
import { generateFakeTranscript } from "@/lib/ai/fake-transcription-provider";
import type { SummarizationInput } from "@/lib/ai/summarization-provider";
import { summarizationOutputSchemaFor } from "@/lib/meetings/summary";

const SPEAKERS = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Amara Okafor" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Ben Liu" },
  { id: "33333333-3333-4333-8333-333333333333", name: "Chloe Martin" },
];

const INPUT: SummarizationInput = {
  title: "Q3 roadmap sync",
  agenda: "Confirm priorities, pick a launch date, assign owners",
  speakers: SPEAKERS,
  transcript: generateFakeTranscript({
    title: "Q3 roadmap sync",
    agenda: "Confirm priorities, pick a launch date, assign owners",
    speakers: SPEAKERS,
    durationMs: 10 * 60_000,
    targetUtteranceCount: 50,
  }),
};

describe("fake SummarizationProvider", () => {
  const provider = createFakeSummarizationProvider();

  it("is deterministic: the same inputs give the same Summary", async () => {
    const first = await provider.summarize(INPUT);
    const second = await createFakeSummarizationProvider().summarize(INPUT);
    expect(second).toEqual(first);
  });

  it("gives a different Summary for a different title", async () => {
    const first = await provider.summarize(INPUT);
    const second = await provider.summarize({
      ...INPUT,
      title: "Design review",
    });
    expect(second).not.toEqual(first);
  });

  it("writes an Overview about the Meeting and 3 to 7 Key Takeaways", async () => {
    const output = await provider.summarize(INPUT);

    expect(output.overview).toContain("Q3 roadmap sync");
    expect(
      output.overview.split(/[.!?](\s|$)/).filter(Boolean).length,
    ).toBeGreaterThanOrEqual(1);
    expect(output.keyTakeaways.length).toBeGreaterThanOrEqual(3);
    expect(output.keyTakeaways.length).toBeLessThanOrEqual(7);
  });

  it("proposes Action Items owned only by the Meeting's Speakers", async () => {
    const output = await provider.summarize(INPUT);
    const speakerIds = new Set(SPEAKERS.map((speaker) => speaker.id));

    expect(output.actionItems.length).toBeGreaterThan(0);
    expect(output.actionItems.length).toBeLessThanOrEqual(10);
    for (const item of output.actionItems) {
      expect(item.text.length).toBeGreaterThan(0);
      if (item.ownerSpeakerId !== null) {
        expect(speakerIds.has(item.ownerSpeakerId)).toBe(true);
      }
    }
    expect(output.actionItems.some((item) => item.ownerSpeakerId)).toBe(true);
  });

  it("passes the summarization rules for its Meeting", async () => {
    const output = await provider.summarize(INPUT);
    const result = summarizationOutputSchemaFor({
      speakerIds: SPEAKERS.map((speaker) => speaker.id),
    }).safeParse(output);
    expect(result.success).toBe(true);
  });

  it("copes with a Meeting that has no agenda and two Speakers", async () => {
    const speakers = SPEAKERS.slice(0, 2);
    const output = await provider.summarize({
      title: "Standup",
      agenda: null,
      speakers,
      transcript: generateFakeTranscript({
        title: "Standup",
        agenda: null,
        speakers,
        durationMs: 3_000,
        targetUtteranceCount: 8,
      }),
    });
    const result = summarizationOutputSchemaFor({
      speakerIds: speakers.map((speaker) => speaker.id),
    }).safeParse(output);
    expect(result.success).toBe(true);
  });
});
