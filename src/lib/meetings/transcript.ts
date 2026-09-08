import { z } from "zod";

/** One Utterance every 12 seconds of Recording is the target density. */
export const UTTERANCE_INTERVAL_MS = 12_000;
export const MIN_UTTERANCES = 8;
export const MAX_UTTERANCES = 80;

/** How many Utterances a Transcript should have for a Recording of `durationMs`, clamped to 8-80. */
export function targetUtteranceCount(durationMs: number): number {
  const target = Math.round(durationMs / UTTERANCE_INTERVAL_MS);
  return Math.min(MAX_UTTERANCES, Math.max(MIN_UTTERANCES, target));
}

export const utteranceSchema = z
  .object({
    speakerId: z.uuid(),
    startMs: z.int().nonnegative(),
    endMs: z.int().nonnegative(),
    text: z.string().trim().min(1),
  })
  .refine((utterance) => utterance.endMs >= utterance.startMs, {
    message: "An Utterance cannot end before it starts",
    path: ["endMs"],
  });

/** Structural shape of the `meetings.transcript` JSONB column (ADR-0004). */
export const transcriptSchema = z.object({
  utterances: z
    .array(utteranceSchema)
    .min(1)
    .refine(
      (utterances) =>
        utterances.every(
          (utterance, index) =>
            index === 0 || utterance.startMs >= utterances[index - 1].startMs,
        ),
      { message: "Utterances must be in chronological order" },
    ),
});

export type Utterance = z.infer<typeof utteranceSchema>;
export type Transcript = z.infer<typeof transcriptSchema>;

export type TranscriptContext = {
  /** Length of the Recording; every timestamp must fall within `[0, durationMs]`. */
  durationMs: number;
  /** Ids of the Meeting's Speakers; every Utterance must belong to one of them. */
  speakerIds: readonly string[];
};

/** The structural schema plus the rules that depend on the Meeting: timestamp bounds and known Speakers. */
export function transcriptSchemaFor(context: TranscriptContext) {
  const known = new Set(context.speakerIds);
  return transcriptSchema.superRefine((transcript, ctx) => {
    transcript.utterances.forEach((utterance, index) => {
      if (!known.has(utterance.speakerId)) {
        ctx.addIssue({
          code: "custom",
          path: ["utterances", index, "speakerId"],
          message:
            "Utterance attributed to a Speaker who is not in the Meeting",
        });
      }
      if (utterance.endMs > context.durationMs) {
        ctx.addIssue({
          code: "custom",
          path: ["utterances", index, "endMs"],
          message: "Utterance runs past the end of the Recording",
        });
      }
    });
  });
}
