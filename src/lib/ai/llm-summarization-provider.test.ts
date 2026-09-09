import { describe, expect, it } from "vitest";

import { createLlmSummarizationProvider } from "@/lib/ai/llm-summarization-provider";
import type { SummarizationInput } from "@/lib/ai/summarization-provider";
import type { SummarizationOutput } from "@/lib/meetings/summary";

import { generatorAnswering } from "../../../tests/structured-generator-stub";

const SPEAKERS = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Amara Okafor" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Ben Liu" },
];

const INPUT: SummarizationInput = {
  title: "Q3 roadmap sync",
  agenda: "Confirm priorities and pick a launch date",
  speakers: SPEAKERS,
  transcript: {
    utterances: [
      {
        speakerId: SPEAKERS[0].id,
        startMs: 0,
        endMs: 4_000,
        text: "Let's confirm the priorities first.",
      },
      {
        speakerId: SPEAKERS[1].id,
        startMs: 65_000,
        endMs: 70_000,
        text: "I can own the launch date proposal by Friday.",
      },
    ],
  },
};

const OUTPUT: SummarizationOutput = {
  overview: "The team confirmed priorities and set a launch date owner.",
  keyTakeaways: ["Priorities confirmed.", "Launch date open.", "Ben owns it."],
  actionItems: [
    {
      text: "Draft the launch date proposal",
      ownerSpeakerId: SPEAKERS[1].id,
      dueDate: "Friday",
    },
  ],
};

describe("LLM SummarizationProvider", () => {
  it("returns the generated Summary and Action Items", async () => {
    const { generator } = generatorAnswering(OUTPUT);
    await expect(
      createLlmSummarizationProvider(generator).summarize(INPUT),
    ).resolves.toEqual(OUTPUT);
  });

  it("asks for a Summary with the title, agenda, Speakers with ids and the timestamped Transcript", async () => {
    const { generator, requests } = generatorAnswering(OUTPUT);
    await createLlmSummarizationProvider(generator).summarize(INPUT);

    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request.document).toBe("Summary");
    expect(request.prompt).toContain("Q3 roadmap sync");
    expect(request.prompt).toContain(
      "Confirm priorities and pick a launch date",
    );
    for (const speaker of SPEAKERS) {
      expect(request.prompt).toContain(speaker.name);
      expect(request.prompt).toContain(speaker.id);
    }
    expect(request.prompt).toContain(
      "[00:00] Amara Okafor: Let's confirm the priorities first.",
    );
    expect(request.prompt).toContain(
      "[01:05] Ben Liu: I can own the launch date proposal by Friday.",
    );
  });

  it("hands over the Meeting-aware schema: owners must be the Meeting's Speakers", async () => {
    const { generator, requests } = generatorAnswering(OUTPUT);
    await createLlmSummarizationProvider(generator).summarize(INPUT);
    const { schema } = requests[0];

    expect(schema.safeParse(OUTPUT).success).toBe(true);
    expect(
      schema.safeParse({
        ...OUTPUT,
        actionItems: [
          {
            ...OUTPUT.actionItems[0],
            ownerSpeakerId: "44444444-4444-4444-8444-444444444444",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ ...OUTPUT, keyTakeaways: ["only one"] }).success,
    ).toBe(false);
  });
});
