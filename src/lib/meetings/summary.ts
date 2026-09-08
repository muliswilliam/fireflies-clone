import { z } from "zod";

export const MIN_KEY_TAKEAWAYS = 3;
export const MAX_KEY_TAKEAWAYS = 7;
export const MAX_ACTION_ITEMS = 10;

/** Structural shape of the `meetings.summary` JSONB column (ADR-0004): the Overview and Key Takeaways. */
export const summarySchema = z.object({
  overview: z.string().trim().min(1),
  keyTakeaways: z
    .array(z.string().trim().min(1))
    .min(MIN_KEY_TAKEAWAYS)
    .max(MAX_KEY_TAKEAWAYS),
});

export type Summary = z.infer<typeof summarySchema>;

/** An Action Item as a provider proposes it, before it becomes a row. */
export const actionItemDraftSchema = z.object({
  text: z.string().trim().min(1),
  /** One of the Meeting's Speakers, or nobody. */
  ownerSpeakerId: z.uuid().nullable(),
  /** Free-form text ("Friday", "end of Q3"); never parsed as a date. */
  dueDate: z.string().trim().min(1).nullable(),
});

export type ActionItemDraft = z.infer<typeof actionItemDraftSchema>;

/** Everything a SummarizationProvider returns: the Summary plus proposed Action Items. */
export const summarizationOutputSchema = summarySchema.extend({
  actionItems: z.array(actionItemDraftSchema).max(MAX_ACTION_ITEMS),
});

export type SummarizationOutput = z.infer<typeof summarizationOutputSchema>;

export type SummarizationContext = {
  /** Ids of the Meeting's Speakers; every Action Item owner must be one of them. */
  speakerIds: readonly string[];
};

/** The structural schema plus the rule that depends on the Meeting: owners are its Speakers. */
export function summarizationOutputSchemaFor(context: SummarizationContext) {
  const known = new Set(context.speakerIds);
  return summarizationOutputSchema.superRefine((output, ctx) => {
    output.actionItems.forEach((item, index) => {
      if (item.ownerSpeakerId !== null && !known.has(item.ownerSpeakerId)) {
        ctx.addIssue({
          code: "custom",
          path: ["actionItems", index, "ownerSpeakerId"],
          message: "Action Item owner is not a Speaker in the Meeting",
        });
      }
    });
  });
}
