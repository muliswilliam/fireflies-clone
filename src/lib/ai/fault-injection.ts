import { PROCESSING_STEPS, type ProcessingStep } from "@/lib/db/schema";

import type { SummarizationProvider } from "./summarization-provider";
import type { TranscriptionProvider } from "./transcription-provider";

/**
 * Test-only fault injection, switched on by `E2E_FAULT_INJECTION=1`.
 *
 * A Meeting whose title carries `[fail:transcribing]` or `[fail:summarizing]` makes the
 * provider for that step throw the first time it is asked about that title. The next call
 * (a Retry) goes through, so an end-to-end test can watch a Meeting fail and then recover
 * without any other channel into the server. Never enabled outside tests.
 */

const DIRECTIVE = /\[fail:([a-z]+)\]/;

/** The step a title asks to fail, or `null` when the title carries no (valid) marker. */
export function failureDirectiveIn(title: string): ProcessingStep | null {
  const step = DIRECTIVE.exec(title)?.[1];
  return step && isProcessingStep(step) ? step : null;
}

function isProcessingStep(value: string): value is ProcessingStep {
  return (PROCESSING_STEPS as readonly string[]).includes(value);
}

/** Remembers which titles have already been failed once, for one step. */
function createOnceGate(step: ProcessingStep) {
  const failedTitles = new Set<string>();
  return function throwIfDue(title: string): void {
    if (failureDirectiveIn(title) !== step || failedTitles.has(title)) return;
    failedTitles.add(title);
    throw new Error(`Injected ${step} failure for "${title}"`);
  };
}

export function withTranscriptionFaultInjection(
  provider: TranscriptionProvider,
): TranscriptionProvider {
  const throwIfDue = createOnceGate("transcribing");
  return {
    async generateTranscript(input) {
      throwIfDue(input.title);
      return provider.generateTranscript(input);
    },
  };
}

export function withSummarizationFaultInjection(
  provider: SummarizationProvider,
): SummarizationProvider {
  const throwIfDue = createOnceGate("summarizing");
  return {
    async summarize(input) {
      throwIfDue(input.title);
      return provider.summarize(input);
    },
  };
}

export function withFaultInjection(providers: {
  transcriptionProvider: TranscriptionProvider;
  summarizationProvider: SummarizationProvider;
}) {
  return {
    transcriptionProvider: withTranscriptionFaultInjection(
      providers.transcriptionProvider,
    ),
    summarizationProvider: withSummarizationFaultInjection(
      providers.summarizationProvider,
    ),
  };
}
