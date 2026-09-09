import type { SummarizationProvider } from "@/lib/ai/summarization-provider";
import type { TranscriptionProvider } from "@/lib/ai/transcription-provider";
import { PROCESSING_STEPS, type ProcessingStep } from "@/lib/db/schema";

/**
 * Test-only fault injection, switched on by `E2E_FAULT_INJECTION=1`.
 *
 * A Meeting whose title carries `[fail:transcribing]` or `[fail:summarizing]` makes the
 * provider for that step throw the first time it is asked about that title. The next call
 * (a Retry) goes through, so an end-to-end test can watch a Meeting fail and then recover
 * without any other channel into the server. A list search carrying `[fail:page]` makes the
 * list page throw, so a test can see the error boundary. Never enabled outside tests.
 *
 * "Once" is remembered inside the provider instance, which lives as long as the cached
 * Meeting service does; a dev-server hot reload forgets it and the next call fails again.
 */

const MARKER = /\[fail:([a-z]+)\]/;

/** The step a title asks to fail, or `null` when the title carries no (valid) marker. */
export function failureMarkerIn(title: string): ProcessingStep | null {
  const step = MARKER.exec(title)?.[1];
  return step && isProcessingStep(step) ? step : null;
}

function isProcessingStep(value: string): value is ProcessingStep {
  return (PROCESSING_STEPS as readonly string[]).includes(value);
}

/** Remembers which titles have already been failed once, for one step. */
function createOnceGate(step: ProcessingStep) {
  const failedTitles = new Set<string>();
  return function throwIfDue(title: string): void {
    if (failureMarkerIn(title) !== step || failedTitles.has(title)) return;
    failedTitles.add(title);
    throw new Error(`Injected ${step} failure for "${title}"`);
  };
}

/** Fails `generateTranscript` once for every title marked `[fail:transcribing]`. */
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

/** Fails `summarize` once for every title marked `[fail:summarizing]`. */
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

const PAGE_MARKER = "[fail:page]";

/**
 * Makes a page render throw when the text it is given (the list search, for instance)
 * carries `[fail:page]`, so an end-to-end test can see the error boundary. Callers gate it on
 * `E2E_FAULT_INJECTION`, like the provider wrappers above.
 */
export function throwIfPageFaultRequested(text: string): void {
  if (text.includes(PAGE_MARKER)) {
    throw new Error(`Injected page failure for "${text}"`);
  }
}
