import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { getEnv } from "@/lib/env";
import {
  withSummarizationFaultInjection,
  withTranscriptionFaultInjection,
} from "@/lib/fault-injection";

import { createAnthropicStructuredGenerator } from "./anthropic-structured-generator";
import type { StructuredGenerator } from "./structured-generator";
import { createLlmSummarizationProvider } from "./llm-summarization-provider";
import { createLlmTranscriptionProvider } from "./llm-transcription-provider";
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
      return createLlmTranscriptionProvider(createAnthropicGenerator());
  }
}

function selectSummarizationProvider(): SummarizationProvider {
  switch (getEnv().AI_PROVIDER) {
    case "fake":
      return createFakeSummarizationProvider();
    case "claude":
      return createLlmSummarizationProvider(createAnthropicGenerator());
  }
}

/** `getEnv` has already insisted on the key when the provider is `claude`. */
function createAnthropicGenerator(): StructuredGenerator {
  const env = getEnv();
  return createAnthropicStructuredGenerator({
    client: new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }),
    model: env.AI_MODEL,
  });
}
