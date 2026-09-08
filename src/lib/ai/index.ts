import "server-only";

import { getEnv } from "@/lib/env";

import { createFakeSummarizationProvider } from "./fake-summarization-provider";
import { createFakeTranscriptionProvider } from "./fake-transcription-provider";
import {
  withSummarizationFaultInjection,
  withTranscriptionFaultInjection,
} from "./fault-injection";
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
  const provider = selectTranscriptionProvider();
  return getEnv().E2E_FAULT_INJECTION
    ? withTranscriptionFaultInjection(provider)
    : provider;
}

/** Picks the SummarizationProvider named by `AI_PROVIDER`. */
export function getSummarizationProvider(): SummarizationProvider {
  const provider = selectSummarizationProvider();
  return getEnv().E2E_FAULT_INJECTION
    ? withSummarizationFaultInjection(provider)
    : provider;
}

function selectTranscriptionProvider(): TranscriptionProvider {
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

function selectSummarizationProvider(): SummarizationProvider {
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
