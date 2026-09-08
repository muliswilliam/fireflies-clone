import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";

import { createClaudeStructuredGenerator } from "@/lib/ai/claude-structured-generator";
import { createClaudeSummarizationProvider } from "@/lib/ai/claude-summarization-provider";
import { createClaudeTranscriptionProvider } from "@/lib/ai/claude-transcription-provider";
import { generateFakeTranscript } from "@/lib/ai/fake-transcription-provider";
import type { TranscriptionInput } from "@/lib/ai/transcription-provider";
import { DEFAULT_AI_MODEL } from "@/lib/env";
import { summarizationOutputSchemaFor } from "@/lib/meetings/summary";
import {
  targetUtteranceCount,
  transcriptSchemaFor,
} from "@/lib/meetings/transcript";

/**
 * Live smoke tests against the real Claude API. They cost money and take a minute, so they
 * only run with `RUN_LIVE=1` and an `ANTHROPIC_API_KEY`; CI never sets either and stays on the fake.
 */
const live = process.env.RUN_LIVE === "1" && !!process.env.ANTHROPIC_API_KEY;

const SPEAKERS = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Amara Okafor" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Ben Liu" },
  { id: "33333333-3333-4333-8333-333333333333", name: "Chloe Martin" },
];

const DURATION_MS = 5 * 60_000;

const INPUT: TranscriptionInput = {
  title: "Q3 roadmap sync",
  agenda:
    "Confirm the top three priorities for Q3, pick a launch date for the reporting feature, decide who owns the customer beta",
  speakers: SPEAKERS,
  durationMs: DURATION_MS,
  targetUtteranceCount: targetUtteranceCount(DURATION_MS),
};

describe.skipIf(!live)("Claude providers (live)", () => {
  const generator = createClaudeStructuredGenerator({
    client: new Anthropic(),
    model: process.env.AI_MODEL ?? DEFAULT_AI_MODEL,
  });

  it(
    "generates a Transcript that obeys the Meeting rules and uses every Speaker",
    { timeout: 180_000 },
    async () => {
      const transcript =
        await createClaudeTranscriptionProvider(generator).generateTranscript(
          INPUT,
        );
      console.log(JSON.stringify(transcript, null, 2));

      const checked = transcriptSchemaFor({
        durationMs: DURATION_MS,
        speakerIds: SPEAKERS.map((speaker) => speaker.id),
      }).safeParse(transcript);
      expect(checked.error?.issues ?? []).toEqual([]);

      const used = new Set(
        transcript.utterances.map((utterance) => utterance.speakerId),
      );
      expect(used.size).toBe(SPEAKERS.length);
      // The count is asked for, not enforced by the schema; a smoke test tolerates some drift.
      expect(transcript.utterances.length).toBeGreaterThanOrEqual(
        Math.floor(INPUT.targetUtteranceCount * 0.6),
      );
      expect(transcript.utterances.length).toBeLessThanOrEqual(
        Math.ceil(INPUT.targetUtteranceCount * 1.4),
      );
    },
  );

  it(
    "summarizes a Transcript with Action Item owners drawn from the Speakers",
    { timeout: 180_000 },
    async () => {
      const output = await createClaudeSummarizationProvider(
        generator,
      ).summarize({
        title: INPUT.title,
        agenda: INPUT.agenda,
        speakers: SPEAKERS,
        transcript: generateFakeTranscript(INPUT),
      });
      console.log(JSON.stringify(output, null, 2));

      const checked = summarizationOutputSchemaFor({
        speakerIds: SPEAKERS.map((speaker) => speaker.id),
      }).safeParse(output);
      expect(checked.error?.issues ?? []).toEqual([]);
      expect(output.overview.length).toBeGreaterThan(40);
    },
  );
});
