import { formatTimestamp } from "@/lib/format";
import {
  transcriptSchemaFor,
  type Transcript,
} from "@/lib/meetings/transcript";

import { speakerList } from "./prompt";
import type { StructuredGenerator } from "./structured-generator";
import type {
  TranscriptionInput,
  TranscriptionProvider,
} from "./transcription-provider";

/** Well above what 80 Utterances need; the ceiling only matters if the model runs away. */
const MAX_TOKENS = 64_000;

/**
 * Measured on Claude Opus 5 for an 80-Utterance Transcript: at the default effort the model
 * spent over five minutes thinking about the timeline before writing; at low effort it thinks
 * not at all, writes the same well-paced Transcript in about two minutes, and stays inside the
 * pipeline's provider timeout. Dialogue is bulk output, not hard reasoning.
 */
const EFFORT = "low";

const SYSTEM = `You write the Transcript of a business meeting that has just ended, as if it had been recorded and transcribed.
The Transcript must read like a real conversation among the named Speakers about the given agenda: people greet each other briefly, build on each other's points, ask questions, disagree politely, reach decisions, and take on follow-ups with rough dates.
Write natural spoken English with the occasional filler or self-correction. No narration, no stage directions, no speaker names or labels inside the spoken text.
Answer only with the JSON document that matches the required schema.`;

/**
 * The LLM TranscriptionProvider (ADR-0001): one structured-output call whose answer is
 * checked against the Meeting's own rules (timestamp bounds, order, known Speakers).
 */
export function createLlmTranscriptionProvider(
  generator: StructuredGenerator,
): TranscriptionProvider {
  return {
    generateTranscript(input) {
      return generator.generate({
        document: "Transcript",
        system: SYSTEM,
        prompt: transcriptPrompt(input),
        schema: llmTranscriptSchemaFor(input),
        maxTokens: MAX_TOKENS,
        effort: EFFORT,
      });
    },
  };
}

/** The Meeting's Transcript rules plus what the prompt asks of the model: every Speaker gets a turn. */
export function llmTranscriptSchemaFor(input: TranscriptionInput) {
  const speakerIds = input.speakers.map((speaker) => speaker.id);
  return transcriptSchemaFor({
    durationMs: input.durationMs,
    speakerIds,
  }).refine(
    (transcript: Transcript) => {
      const heard = new Set(
        transcript.utterances.map((utterance) => utterance.speakerId),
      );
      return speakerIds.every((id) => heard.has(id));
    },
    { message: "Not every Speaker in the Meeting says anything" },
  );
}

/** Spoken English runs at about 150 words a minute. */
const WORDS_PER_SECOND = 2.5;

/** How many timeline anchors the prompt lists; enough to keep the pace honest without a wall of numbers. */
const ANCHOR_COUNT = 8;

export function transcriptPrompt(input: TranscriptionInput): string {
  // Without a concrete pace the model writes short turns and the conversation ends long before
  // the Recording does; the average slot and its word count anchor both timing and length.
  const secondsPerUtterance = Math.round(
    input.durationMs / 1000 / input.targetUtteranceCount,
  );
  const wordsPerUtterance = Math.round(secondsPerUtterance * WORDS_PER_SECOND);
  return `Meeting title: ${input.title}
Agenda: ${input.agenda ?? "none given; infer a plausible agenda from the title"}
Recording duration: ${formatTimestamp(input.durationMs)} (${input.durationMs} ms)
Speakers:
${speakerList(input.speakers)}

Produce exactly ${input.targetUtteranceCount} Utterances covering the whole Recording; count them and do not go over.

Rules:
- speakerId is one of the ids listed above, copied exactly. Every Speaker speaks at least once, and nobody speaks twice in a row unless it reads naturally.
- startMs and endMs are integer milliseconds from the start of the Recording, between 0 and ${input.durationMs}.
- Utterances are in chronological order and do not overlap: each startMs is at or after the previous endMs, and each endMs is after its own startMs.
- Pace: ${input.targetUtteranceCount} Utterances across ${formatTimestamp(input.durationMs)} means an average Utterance spans about ${secondsPerUtterance} seconds, which at a natural speaking pace is about ${wordsPerUtterance} words. Vary around that average; a turn's length in milliseconds must match its word count, with small gaps between turns.
- Timeline anchors, Utterance number and its start time: ${timelineAnchors(input)}. Keep to this schedule so the conversation fills the whole ${formatTimestamp(input.durationMs)} and the last Utterance ends by then.
- The conversation works through the agenda and ends with a clear wrap-up of what was decided and who does what.`;
}

/**
 * "1 at 00:00, 11 at 03:45, ..., 80 at 29:37". Measured on Claude Opus 5: with only an average
 * pace to go on, the model ends a 30-minute Meeting anywhere between 12 and 30 minutes in; with
 * these anchors it lands within the last minute every time, and without thinking about it.
 */
export function timelineAnchors(input: TranscriptionInput): string {
  const count = input.targetUtteranceCount;
  const slotMs = input.durationMs / count;
  const step = Math.max(1, Math.round(count / ANCHOR_COUNT));
  const numbers: number[] = [];
  for (let n = 1; n <= count; n += step) numbers.push(n);
  if (numbers.at(-1) !== count) numbers.push(count);
  return numbers
    .map((n) => `${n} at ${formatTimestamp((n - 1) * slotMs)}`)
    .join(", ");
}
