import { formatTimestamp } from "@/lib/format";
import {
  MAX_ACTION_ITEMS,
  MAX_KEY_TAKEAWAYS,
  MIN_KEY_TAKEAWAYS,
  summarizationOutputSchemaFor,
} from "@/lib/meetings/summary";

import type { ClaudeStructuredGenerator } from "./claude-structured-generator";
import type {
  SummarizationInput,
  SummarizationProvider,
} from "./summarization-provider";

/** A Summary is short; the ceiling only matters if the model runs away. */
const MAX_TOKENS = 16_000;

const SYSTEM = `You distil a meeting Transcript into a Summary: an Overview, Key Takeaways and Action Items.
Everything you write must be supported by the Transcript. Do not invent decisions, owners or dates, and do not pad with generalities.
Answer only with the JSON document that matches the required schema.`;

/**
 * The Claude SummarizationProvider: one structured-output call whose answer is checked
 * against the Meeting's own rule that Action Item owners are its Speakers.
 */
export function createClaudeSummarizationProvider(
  generator: ClaudeStructuredGenerator,
): SummarizationProvider {
  return {
    summarize(input) {
      return generator.generate({
        document: "Summary",
        system: SYSTEM,
        prompt: summaryPrompt(input),
        schema: summarizationOutputSchemaFor({
          speakerIds: input.speakers.map((speaker) => speaker.id),
        }),
        maxTokens: MAX_TOKENS,
      });
    },
  };
}

export function summaryPrompt(input: SummarizationInput): string {
  const nameById = new Map(
    input.speakers.map((speaker) => [speaker.id, speaker.name]),
  );
  const speakers = input.speakers
    .map((speaker) => `- ${speaker.name} (speakerId: ${speaker.id})`)
    .join("\n");
  const transcript = input.transcript.utterances
    .map(
      (utterance) =>
        `[${formatTimestamp(utterance.startMs)}] ${nameById.get(utterance.speakerId) ?? utterance.speakerId}: ${utterance.text}`,
    )
    .join("\n");
  return `Meeting title: ${input.title}
Agenda: ${input.agenda ?? "none given"}
Speakers:
${speakers}

Transcript:
${transcript}

Return:
- overview: two to four sentences on what the Meeting was about and what came out of it, in plain prose.
- keyTakeaways: ${MIN_KEY_TAKEAWAYS} to ${MAX_KEY_TAKEAWAYS} points, each one complete sentence stating a decision, finding, or open question, in the order they came up.
- actionItems: up to ${MAX_ACTION_ITEMS} concrete follow-ups that were actually agreed, each phrased as a task ("Draft the launch plan"). ownerSpeakerId is the speakerId of the Speaker who took it on, or null when nobody did. dueDate is the timing as said in the Transcript ("Friday", "end of Q3"), or null when none was given. Return an empty list when nothing was agreed.`;
}
