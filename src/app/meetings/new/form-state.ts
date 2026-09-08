import type { MeetingValidationIssue } from "@/lib/meetings";

/** What the create form learns back from a failed submission. Lives outside the server module so the client can import it. */
export type CreateMeetingFormState = {
  issues: MeetingValidationIssue[];
  /** A problem with the whole submission rather than one field. */
  formError: string | null;
};

export const INITIAL_CREATE_MEETING_STATE: CreateMeetingFormState = {
  issues: [],
  formError: null,
};

/** The two ways to submit the form: start a live Recording, or create an Instant Meeting. */
export const CREATE_INTENTS = ["start", "instant"] as const;
export type CreateIntent = (typeof CREATE_INTENTS)[number];

export function isCreateIntent(value: unknown): value is CreateIntent {
  return (CREATE_INTENTS as readonly unknown[]).includes(value);
}
