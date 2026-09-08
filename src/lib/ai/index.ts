import "server-only";

import { getEnv } from "@/lib/env";

import { createFakeSummarizationProvider } from "./fake-summarization-provider";
import { createFakeTranscriptionProvider } from "./fake-transcription-provider";
import type { SummarizationProvider } from "./summarization-provider";
import type { TranscriptionProvider } from "./transcription-provider";

export type {
  SummarizationInput,
  SummarizationProvider,
} from "./summarization-provider";
export type {
  TranscriptionInput,
  TranscriptionProvider,
  TranscriptionSpeaker,
} from "./transcription-provider";

/** Picks the TranscriptionProvider named by `AI_PROVIDER` (ADR-0001). */
export function getTranscriptionProvider(): TranscriptionProvider {
  switch (getEnv().AI_PROVIDER) {
    case "fake":
      return createFakeTranscriptionProvider();
    case "claude":
      // #8 replaces this with the Claude adapter. Failing inside the pipeline, rather than at
      // startup, keeps the rest of the app usable and shows the reason on the Meeting.
      return {
        async generateTranscript() {
          throw new Error(
            "The Claude TranscriptionProvider is not available yet. Set AI_PROVIDER=fake.",
          );
        },
      };
  }
}

/** Picks the SummarizationProvider named by `AI_PROVIDER`. */
export function getSummarizationProvider(): SummarizationProvider {
  switch (getEnv().AI_PROVIDER) {
    case "fake":
      return createFakeSummarizationProvider();
    case "claude":
      // #8 replaces this with the Claude adapter; see getTranscriptionProvider.
      return {
        async summarize() {
          throw new Error(
            "The Claude SummarizationProvider is not available yet. Set AI_PROVIDER=fake.",
          );
        },
      };
  }
}
