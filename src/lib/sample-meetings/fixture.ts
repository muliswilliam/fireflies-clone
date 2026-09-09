import { z } from "zod";

import { MeetingValidationError } from "@/lib/meetings/errors";
import {
  actionItemDraftSchema,
  MAX_ACTION_ITEMS,
  summarizationOutputSchemaFor,
  summarySchema,
} from "@/lib/meetings/summary";
import {
  transcriptSchema,
  transcriptSchemaFor,
} from "@/lib/meetings/transcript";
import { validateMeetingInput } from "@/lib/meetings/validation";

import mobileOnboardingFunnelReview from "./fixtures/mobile-onboarding-funnel-review.json" with { type: "json" };
import postmortemCheckoutOutage from "./fixtures/postmortem-checkout-outage.json" with { type: "json" };
import q4LaunchReadinessReview from "./fixtures/q4-launch-readiness-review.json" with { type: "json" };

/**
 * A Sample Meeting as checked in: a ready Meeting with every id fixed, so the seeder can
 * upsert it and two runs land on the same rows. Speaker ids are what the Transcript's
 * Utterances and the Action Items refer to, exactly as a provider would.
 */
export const sampleMeetingFixtureSchema = z
  .object({
    id: z.uuid(),
    title: z.string().trim().min(1),
    agenda: z.string().trim().min(1).nullable(),
    recordingStartedAt: z.iso.datetime(),
    recordingEndedAt: z.iso.datetime(),
    speakers: z.array(z.object({ id: z.uuid(), name: z.string() })),
    transcript: transcriptSchema,
    summary: summarySchema,
    actionItems: z
      .array(actionItemDraftSchema.extend({ id: z.uuid() }))
      .max(MAX_ACTION_ITEMS),
  })
  .superRefine((fixture, ctx) => {
    const durationMs =
      Date.parse(fixture.recordingEndedAt) -
      Date.parse(fixture.recordingStartedAt);
    if (durationMs <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["recordingEndedAt"],
        message: "The Recording must end after it starts",
      });
    }

    // The same title and Speaker rules every Meeting is created under.
    try {
      validateMeetingInput({
        title: fixture.title,
        speakers: fixture.speakers.map((speaker) => speaker.name),
        agenda: fixture.agenda,
      });
    } catch (error) {
      if (!(error instanceof MeetingValidationError)) throw error;
      for (const issue of error.issues) {
        // Issue paths are dotted ("speakers.1"); a Speaker's name lives one level deeper here.
        const path: PropertyKey[] = issue.path
          .split(".")
          .map((part) => (/^\d+$/.test(part) ? Number(part) : part));
        if (path[0] === "speakers" && path.length === 2) path.push("name");
        ctx.addIssue({ code: "custom", path, message: issue.message });
      }
    }

    // The same Meeting-dependent rules the pipeline applies to a provider's answer.
    const speakerIds = fixture.speakers.map((speaker) => speaker.id);
    forwardIssues(
      ctx,
      ["transcript"],
      transcriptSchemaFor({ durationMs, speakerIds }).safeParse(
        fixture.transcript,
      ),
    );
    forwardIssues(
      ctx,
      [],
      summarizationOutputSchemaFor({ speakerIds }).safeParse({
        ...fixture.summary,
        actionItems: fixture.actionItems,
      }),
    );
  });

export type SampleMeetingFixture = z.infer<typeof sampleMeetingFixtureSchema>;

/** Every checked-in Sample Meeting, before validation. Add a file here to add a Sample Meeting. */
const RAW_FIXTURES: unknown[] = [
  q4LaunchReadinessReview,
  mobileOnboardingFunnelReview,
  postmortemCheckoutOutage,
];

/** Validates one fixture; throws naming what is wrong. */
export function parseSampleMeetingFixture(raw: unknown): SampleMeetingFixture {
  const result = sampleMeetingFixtureSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid Sample Meeting fixture:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

/** The checked-in Sample Meetings, validated, in the order they are listed. Ids must be unique. */
export function loadSampleMeetingFixtures(): SampleMeetingFixture[] {
  const fixtures = RAW_FIXTURES.map(parseSampleMeetingFixture);
  const ids = new Set(fixtures.map((fixture) => fixture.id));
  if (ids.size !== fixtures.length) {
    throw new Error("Sample Meeting fixtures must have unique ids");
  }
  return fixtures;
}

/** Re-issues a nested schema's failures at `prefix`, so a fixture error points at the exact field. */
function forwardIssues(
  ctx: z.RefinementCtx,
  prefix: PropertyKey[],
  result: z.ZodSafeParseResult<unknown>,
) {
  if (result.success) return;
  for (const issue of result.error.issues) {
    ctx.addIssue({
      code: "custom",
      path: [...prefix, ...issue.path],
      message: issue.message,
    });
  }
}
