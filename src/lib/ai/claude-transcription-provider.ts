import { formatTimestamp } from "@/lib/format";
import {
  transcriptSchemaFor,
  type Transcript,
} from "@/lib/meetings/transcript";

import { speakerList } from "./claude-prompt";
import type { ClaudeStructuredGenerator } from "./claude-structured-generator";
import type {
  TranscriptionInput,
  TranscriptionProvider,
} from "./transcription-provider";

/** Well above what 80 Utterances need; the ceiling only matters if the model runs away. */
const MAX_TOKENS = 64_000;

const SYSTEM = `You write the Transcript of a business meeting that has just ended, as if it had been recorded and transcribed.
The Transcript must read like a real conversation among the named Speakers about the given agenda: people greet each other briefly, build on each other's points, ask questions, disagree politely, reach decisions, and take on follow-ups with rough dates.
Write natural spoken English with the occasional filler or self-correction. No narration, no stage directions, no speaker names or labels inside the spoken text.
Answer only with the JSON document that matches the required schema.`;

/**
 * The Claude TranscriptionProvider (ADR-0001): one structured-output call whose answer is
 * checked against the Meeting's own rules (timestamp bounds, order, known Speakers).
 */
export function createClaudeTranscriptionProvider(
  generator: ClaudeStructuredGenerator,
): TranscriptionProvider {
  return {
    generateTranscript(input) {
      return generator.generate({
        document: "Transcript",
        system: SYSTEM,
        prompt: transcriptPrompt(input),
        schema: claudeTranscriptSchemaFor(input),
        maxTokens: MAX_TOKENS,
      });
    },
  };
}

/** The Meeting's Transcript rules plus what the prompt asks of Claude: every Speaker gets a turn. */
export function claudeTranscriptSchemaFor(input: TranscriptionInput) {
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

export function transcriptPrompt(input: TranscriptionInput): string {
  return `Meeting title: ${input.title}
Agenda: ${input.agenda ?? "none given; infer a plausible agenda from the title"}
Recording duration: ${formatTimestamp(input.durationMs)} (${input.durationMs} ms)
Speakers:
${speakerList(input.speakers)}

Produce exactly ${input.targetUtteranceCount} Utterances covering the whole Recording.

Rules:
- speakerId is one of the ids listed above, copied exactly. Every Speaker speaks at least once, and nobody speaks twice in a row unless it reads naturally.
- startMs and endMs are integer milliseconds from the start of the Recording, between 0 and ${input.durationMs}.
- Utterances are in chronological order and do not overlap: each startMs is at or after the previous endMs, and each endMs is after its own startMs.
- The length of each Utterance matches its text at a natural speaking pace (about 150 words a minute); leave small gaps between turns.
- The first Utterance starts near 0 and the last ends close to ${input.durationMs}, so the conversation fills the Recording.
- The conversation works through the agenda and ends with a clear wrap-up of what was decided and who does what.`;
}
