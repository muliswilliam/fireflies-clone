import { describe, expect, it } from "vitest";

import { createClaudeTranscriptionProvider } from "@/lib/ai/claude-transcription-provider";
import type { TranscriptionInput } from "@/lib/ai/transcription-provider";
import type { Transcript } from "@/lib/meetings/transcript";

import { generatorAnswering } from "../../../tests/structured-generator-stub";

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

const TRANSCRIPT: Transcript = {
  utterances: [
    { speakerId: SPEAKERS[0].id, startMs: 0, endMs: 4_000, text: "Hello all." },
    { speakerId: SPEAKERS[1].id, startMs: 4_500, endMs: 9_000, text: "Hi." },
    { speakerId: SPEAKERS[2].id, startMs: 9_500, endMs: 12_000, text: "Hey." },
  ],
};

describe("Claude TranscriptionProvider", () => {
  it("returns the generated Transcript", async () => {
    const { generator } = generatorAnswering(TRANSCRIPT);
    const provider = createClaudeTranscriptionProvider(generator);
    await expect(provider.generateTranscript(INPUT)).resolves.toEqual(
      TRANSCRIPT,
    );
  });

  it("asks for a Transcript with the title, agenda, every Speaker and id, duration and target count", async () => {
    const { generator, requests } = generatorAnswering(TRANSCRIPT);
    await createClaudeTranscriptionProvider(generator).generateTranscript(
      INPUT,
    );

    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request.document).toBe("Transcript");
    expect(request.effort).toBe("low");
    expect(request.system).toMatch(/Transcript/);
    for (const speaker of SPEAKERS) {
      expect(request.prompt).toContain(speaker.name);
      expect(request.prompt).toContain(speaker.id);
    }
    expect(request.prompt).toContain("Q3 roadmap sync");
    expect(request.prompt).toContain(
      "Confirm priorities and pick a launch date",
    );
    expect(request.prompt).toContain("600000");
    expect(request.prompt).toContain("10:00");
    expect(request.prompt).toMatch(/exactly 50 Utterances/);
  });

  it("anchors the timeline: Utterance numbers with start times up to the last one", async () => {
    const { generator, requests } = generatorAnswering(TRANSCRIPT);
    await createClaudeTranscriptionProvider(generator).generateTranscript(
      INPUT,
    );
    // 50 Utterances over 10 minutes: one every 12 s, anchors every 6 Utterances, ending on the 50th.
    expect(requests[0].prompt).toContain(
      "1 at 00:00, 7 at 01:12, 13 at 02:24, 19 at 03:36, 25 at 04:48, 31 at 06:00, 37 at 07:12, 43 at 08:24, 49 at 09:36, 50 at 09:48",
    );
  });

  it("tells the model the pace: average seconds and words per Utterance", async () => {
    const { generator, requests } = generatorAnswering(TRANSCRIPT);
    await createClaudeTranscriptionProvider(generator).generateTranscript(
      INPUT,
    );
    // 10 minutes over 50 Utterances is 12 s each, about 30 words at 150 words a minute.
    expect(requests[0].prompt).toMatch(/about 12 seconds/);
    expect(requests[0].prompt).toMatch(/about 30 words/);
  });

  it("says so when the Meeting has no agenda", async () => {
    const { generator, requests } = generatorAnswering(TRANSCRIPT);
    await createClaudeTranscriptionProvider(generator).generateTranscript({
      ...INPUT,
      agenda: null,
    });
    expect(requests[0].prompt).toMatch(/Agenda: none given/);
  });

  it("hands over the Meeting-aware schema: bounds, order and known Speakers", async () => {
    const { generator, requests } = generatorAnswering(TRANSCRIPT);
    await createClaudeTranscriptionProvider(generator).generateTranscript(
      INPUT,
    );
    const { schema } = requests[0];

    expect(schema.safeParse(TRANSCRIPT).success).toBe(true);
    expect(
      schema.safeParse({
        utterances: [
          { ...TRANSCRIPT.utterances[0], endMs: INPUT.durationMs + 1 },
        ],
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        utterances: [
          {
            ...TRANSCRIPT.utterances[0],
            speakerId: "44444444-4444-4444-8444-444444444444",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        utterances: [TRANSCRIPT.utterances[1], TRANSCRIPT.utterances[0]],
      }).success,
    ).toBe(false);
  });

  it("rejects a Transcript in which a Speaker never says anything", async () => {
    const { generator, requests } = generatorAnswering(TRANSCRIPT);
    await createClaudeTranscriptionProvider(generator).generateTranscript(
      INPUT,
    );
    const result = requests[0].schema.safeParse({
      utterances: TRANSCRIPT.utterances.slice(0, 2),
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/every Speaker/);
  });
});
