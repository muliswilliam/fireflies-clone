import type { SummarizationOutput } from "@/lib/meetings/summary";
import type { Transcript } from "@/lib/meetings/transcript";

import type { TranscriptionSpeaker } from "./transcription-provider";

export type SummarizationInput = {
  title: string;
  agenda: string | null;
  /** The Meeting's Speakers in position order. Action Item owners must be drawn from them. */
  speakers: TranscriptionSpeaker[];
  transcript: Transcript;
};

/**
 * Distils a Transcript into a Summary and Action Items.
 * Implementations: a deterministic fake for tests, and a model-backed one over a StructuredGenerator.
 * Callers validate the result with `summarizationOutputSchemaFor`; a rejected result is a provider error.
 */
export interface SummarizationProvider {
  summarize(input: SummarizationInput): Promise<SummarizationOutput>;
}
