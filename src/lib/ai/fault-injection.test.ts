import { describe, expect, it } from "vitest";

import { createFakeSummarizationProvider } from "./fake-summarization-provider";
import {
  createFakeTranscriptionProvider,
  generateFakeTranscript,
} from "./fake-transcription-provider";
import {
  failureDirectiveIn,
  withFaultInjection,
  withTranscriptionFaultInjection,
} from "./fault-injection";
import type { SummarizationInput } from "./summarization-provider";
import type { TranscriptionInput } from "./transcription-provider";

const speakers = [
  { id: "00000000-0000-4000-8000-000000000001", name: "Amara" },
  { id: "00000000-0000-4000-8000-000000000002", name: "Ben" },
];

function transcriptionInput(title: string): TranscriptionInput {
  return {
    title,
    agenda: null,
    speakers,
    durationMs: 60_000,
    targetUtteranceCount: 8,
  };
}

function summarizationInput(title: string): SummarizationInput {
  return {
    title,
    agenda: null,
    speakers,
    transcript: generateFakeTranscript(transcriptionInput(title)),
  };
}

describe("failureDirectiveIn", () => {
  it("reads the step to fail from a [fail:<step>] marker anywhere in the title", () => {
    expect(failureDirectiveIn("Sync [fail:transcribing]")).toBe("transcribing");
    expect(failureDirectiveIn("[fail:summarizing] Sync 42")).toBe(
      "summarizing",
    );
  });

  it("ignores titles without a marker or with an unknown step", () => {
    expect(failureDirectiveIn("Q3 roadmap sync")).toBeNull();
    expect(failureDirectiveIn("Sync [fail:recording]")).toBeNull();
    expect(failureDirectiveIn("Sync [fail]")).toBeNull();
  });
});

describe("withTranscriptionFaultInjection", () => {
  it("fails the first call for a marked title, then passes the next one through", async () => {
    const provider = withTranscriptionFaultInjection(
      createFakeTranscriptionProvider(),
    );
    const input = transcriptionInput("Sync [fail:transcribing]");

    await expect(provider.generateTranscript(input)).rejects.toThrow(
      /Injected transcribing failure/,
    );
    await expect(provider.generateTranscript(input)).resolves.toEqual(
      generateFakeTranscript(input),
    );
  });

  it("fails each marked title once, independently of the others", async () => {
    const provider = withTranscriptionFaultInjection(
      createFakeTranscriptionProvider(),
    );
    const first = transcriptionInput("First [fail:transcribing]");
    const second = transcriptionInput("Second [fail:transcribing]");

    await expect(provider.generateTranscript(first)).rejects.toThrow();
    await expect(provider.generateTranscript(second)).rejects.toThrow();
    await expect(provider.generateTranscript(first)).resolves.toBeDefined();
    await expect(provider.generateTranscript(second)).resolves.toBeDefined();
  });

  it("leaves titles marked for the other step, or not marked, alone", async () => {
    const provider = withTranscriptionFaultInjection(
      createFakeTranscriptionProvider(),
    );

    await expect(
      provider.generateTranscript(
        transcriptionInput("Sync [fail:summarizing]"),
      ),
    ).resolves.toBeDefined();
    await expect(
      provider.generateTranscript(transcriptionInput("Sync")),
    ).resolves.toBeDefined();
  });
});

describe("withFaultInjection", () => {
  it("wraps both providers, each failing once for its own step", async () => {
    const { transcriptionProvider, summarizationProvider } = withFaultInjection(
      {
        transcriptionProvider: createFakeTranscriptionProvider(),
        summarizationProvider: createFakeSummarizationProvider(),
      },
    );
    const title = "Sync [fail:summarizing]";

    await expect(
      transcriptionProvider.generateTranscript(transcriptionInput(title)),
    ).resolves.toBeDefined();
    await expect(
      summarizationProvider.summarize(summarizationInput(title)),
    ).rejects.toThrow(/Injected summarizing failure/);
    await expect(
      summarizationProvider.summarize(summarizationInput(title)),
    ).resolves.toBeDefined();
  });
});
