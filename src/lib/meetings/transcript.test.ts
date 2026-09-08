import { describe, expect, it } from "vitest";

import {
  MAX_UTTERANCES,
  MIN_UTTERANCES,
  targetUtteranceCount,
  transcriptSchema,
  transcriptSchemaFor,
} from "@/lib/meetings/transcript";

const SPEAKER_A = "11111111-1111-4111-8111-111111111111";
const SPEAKER_B = "22222222-2222-4222-8222-222222222222";

describe("targetUtteranceCount", () => {
  it("aims for one Utterance every 12 seconds", () => {
    expect(targetUtteranceCount(10 * 60_000)).toBe(50);
    expect(targetUtteranceCount(3 * 60_000)).toBe(15);
  });

  it("never goes below 8 for a short Recording", () => {
    expect(targetUtteranceCount(0)).toBe(MIN_UTTERANCES);
    expect(targetUtteranceCount(10_000)).toBe(8);
    expect(targetUtteranceCount(96_000)).toBe(8);
  });

  it("never goes above 80 for a long Recording", () => {
    expect(targetUtteranceCount(16 * 60_000)).toBe(80);
    expect(targetUtteranceCount(3 * 60 * 60_000)).toBe(MAX_UTTERANCES);
  });
});

describe("transcriptSchema", () => {
  const utterance = {
    speakerId: SPEAKER_A,
    startMs: 0,
    endMs: 4_000,
    text: "Let's get started.",
  };

  it("accepts a well-formed Transcript", () => {
    const parsed = transcriptSchema.parse({
      utterances: [utterance, { ...utterance, startMs: 4_000, endMs: 9_000 }],
    });
    expect(parsed.utterances).toHaveLength(2);
  });

  it("rejects an Utterance without text", () => {
    expect(
      transcriptSchema.safeParse({ utterances: [{ ...utterance, text: "  " }] })
        .success,
    ).toBe(false);
  });

  it("rejects a negative or fractional start", () => {
    expect(
      transcriptSchema.safeParse({
        utterances: [{ ...utterance, startMs: -1 }],
      }).success,
    ).toBe(false);
    expect(
      transcriptSchema.safeParse({
        utterances: [{ ...utterance, startMs: 1.5 }],
      }).success,
    ).toBe(false);
  });

  it("rejects an Utterance that ends before it starts", () => {
    expect(
      transcriptSchema.safeParse({
        utterances: [{ ...utterance, startMs: 5_000, endMs: 4_000 }],
      }).success,
    ).toBe(false);
  });

  it("rejects Utterances whose starts go backwards", () => {
    expect(
      transcriptSchema.safeParse({
        utterances: [
          { ...utterance, startMs: 5_000, endMs: 6_000 },
          { ...utterance, startMs: 4_000, endMs: 6_000 },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects a Transcript with no Utterances", () => {
    expect(transcriptSchema.safeParse({ utterances: [] }).success).toBe(false);
  });

  it("rejects a speaker id that is not a uuid", () => {
    expect(
      transcriptSchema.safeParse({
        utterances: [{ ...utterance, speakerId: "amara" }],
      }).success,
    ).toBe(false);
  });
});

describe("transcriptSchemaFor", () => {
  const schema = transcriptSchemaFor({
    durationMs: 60_000,
    speakerIds: [SPEAKER_A, SPEAKER_B],
  });
  const utterance = {
    speakerId: SPEAKER_A,
    startMs: 0,
    endMs: 4_000,
    text: "Hello",
  };

  it("accepts Utterances within the Recording by known Speakers", () => {
    expect(
      schema.safeParse({
        utterances: [utterance, { ...utterance, speakerId: SPEAKER_B }],
      }).success,
    ).toBe(true);
  });

  it("rejects an Utterance attributed to a Speaker not in the Meeting", () => {
    const result = schema.safeParse({
      utterances: [
        { ...utterance, speakerId: "33333333-3333-4333-8333-333333333333" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an Utterance that runs past the end of the Recording", () => {
    expect(
      schema.safeParse({
        utterances: [{ ...utterance, startMs: 59_000, endMs: 61_000 }],
      }).success,
    ).toBe(false);
  });
});
