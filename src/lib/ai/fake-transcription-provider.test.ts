import { describe, expect, it } from "vitest";

import { createFakeTranscriptionProvider } from "@/lib/ai/fake-transcription-provider";
import type { TranscriptionInput } from "@/lib/ai/transcription-provider";
import { transcriptSchemaFor } from "@/lib/meetings/transcript";

const SPEAKERS = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Amara Okafor" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Ben Liu" },
  { id: "33333333-3333-4333-8333-333333333333", name: "Chloe Martin" },
];

const INPUT: TranscriptionInput = {
  title: "Q3 roadmap sync",
  agenda: "Confirm priorities and pick a launch date",
  speakers: SPEAKERS,
  durationMs: 10 * 60_000,
  targetUtteranceCount: 50,
};

describe("fake TranscriptionProvider", () => {
  const provider = createFakeTranscriptionProvider();

  it("returns exactly the target number of Utterances", async () => {
    const transcript = await provider.generateTranscript(INPUT);
    expect(transcript.utterances).toHaveLength(50);
  });

  it("is deterministic: the same inputs give the same Transcript", async () => {
    const first = await provider.generateTranscript(INPUT);
    const second =
      await createFakeTranscriptionProvider().generateTranscript(INPUT);
    expect(second).toEqual(first);
  });

  it("gives a different Transcript for a different title", async () => {
    const first = await provider.generateTranscript(INPUT);
    const second = await provider.generateTranscript({
      ...INPUT,
      title: "Design review",
    });
    expect(second).not.toEqual(first);
  });

  it("keeps timestamps within the Recording, in order, with every Utterance ending after it starts", async () => {
    const { utterances } = await provider.generateTranscript(INPUT);

    let previousStart = 0;
    for (const utterance of utterances) {
      expect(utterance.startMs).toBeGreaterThanOrEqual(previousStart);
      expect(utterance.endMs).toBeGreaterThanOrEqual(utterance.startMs);
      expect(utterance.endMs).toBeLessThanOrEqual(INPUT.durationMs);
      previousStart = utterance.startMs;
    }
    expect(utterances.at(-1)!.endMs).toBeGreaterThan(INPUT.durationMs * 0.8);
  });

  it("attributes every Utterance to a known Speaker and lets every Speaker talk", async () => {
    const { utterances } = await provider.generateTranscript(INPUT);
    const spoken = new Set(utterances.map((utterance) => utterance.speakerId));

    expect(spoken).toEqual(new Set(SPEAKERS.map((speaker) => speaker.id)));
  });

  it("passes the Transcript rules for its Meeting", async () => {
    const transcript = await provider.generateTranscript(INPUT);
    const result = transcriptSchemaFor({
      durationMs: INPUT.durationMs,
      speakerIds: SPEAKERS.map((speaker) => speaker.id),
    }).safeParse(transcript);
    expect(result.success).toBe(true);
  });

  it("copes with a Recording of a few seconds", async () => {
    const transcript = await provider.generateTranscript({
      ...INPUT,
      durationMs: 2_000,
      targetUtteranceCount: 8,
    });
    const result = transcriptSchemaFor({
      durationMs: 2_000,
      speakerIds: SPEAKERS.map((speaker) => speaker.id),
    }).safeParse(transcript);
    expect(result.success).toBe(true);
    expect(transcript.utterances).toHaveLength(8);
  });

  it("copes with a Recording of zero length", async () => {
    const transcript = await provider.generateTranscript({
      ...INPUT,
      durationMs: 0,
      targetUtteranceCount: 8,
    });
    expect(transcript.utterances).toHaveLength(8);
    expect(
      transcript.utterances.every((u) => u.startMs === 0 && u.endMs === 0),
    ).toBe(true);
  });
});
