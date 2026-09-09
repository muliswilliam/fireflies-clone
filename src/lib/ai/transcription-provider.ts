import type { Transcript } from "@/lib/meetings/transcript";

export type TranscriptionSpeaker = {
  id: string;
  name: string;
};

export type TranscriptionInput = {
  title: string;
  agenda: string | null;
  /** The Meeting's Speakers in position order. Every Utterance must be attributed to one of them. */
  speakers: TranscriptionSpeaker[];
  /** Length of the Recording. Timestamps must fall within `[0, durationMs]`. */
  durationMs: number;
  /** How many Utterances to produce; see `targetUtteranceCount`. */
  targetUtteranceCount: number;
};

/**
 * Produces a Transcript for a finished Recording (ADR-0001).
 * Implementations: a deterministic fake for tests, and a model-backed one over a StructuredGenerator.
 * Callers validate the result with `transcriptSchemaFor`; a rejected result is a provider error.
 */
export interface TranscriptionProvider {
  generateTranscript(input: TranscriptionInput): Promise<Transcript>;
}
