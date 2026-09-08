import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { getEnv } from "@/lib/env";

import {
  createClaudeStructuredGenerator,
  type ClaudeStructuredGenerator,
} from "./claude-structured-generator";
import { createClaudeSummarizationProvider } from "./claude-summarization-provider";
import { createClaudeTranscriptionProvider } from "./claude-transcription-provider";
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
      return createClaudeTranscriptionProvider(getClaudeGenerator());
  }
}

function selectSummarizationProvider(): SummarizationProvider {
  switch (getEnv().AI_PROVIDER) {
    case "fake":
      return createFakeSummarizationProvider();
    case "claude":
      return createClaudeSummarizationProvider(getClaudeGenerator());
  }
}

let claudeGenerator: ClaudeStructuredGenerator | undefined;

/** One Claude client for both providers. `getEnv` has already insisted on the key when the provider is `claude`. */
function getClaudeGenerator(): ClaudeStructuredGenerator {
  const env = getEnv();
  claudeGenerator ??= createClaudeStructuredGenerator({
    client: new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }),
    model: env.AI_MODEL,
  });
  return claudeGenerator;
}
