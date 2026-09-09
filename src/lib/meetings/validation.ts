import { MeetingValidationError, type MeetingValidationIssue } from "./errors";

/** Shown wherever a blank title is refused, on the server and inline in the client. */
export const MEETING_TITLE_REQUIRED_MESSAGE = "Give the Meeting a title";

export const MIN_SPEAKERS = 2;
export const MAX_SPEAKERS = 6;

/** How long an Instant Meeting's Recording may be said to have run, in minutes. */
export const INSTANT_MEETING_DURATION_OPTIONS_MINUTES = [
  5, 15, 30, 60,
] as const;
export type InstantMeetingDurationMinutes =
  (typeof INSTANT_MEETING_DURATION_OPTIONS_MINUTES)[number];
export const DEFAULT_INSTANT_MEETING_DURATION_MINUTES: InstantMeetingDurationMinutes = 30;

export type MeetingInput = {
  title: string;
  speakers: string[];
  agenda?: string | null;
};

export type ValidatedMeetingInput = {
  title: string;
  speakers: string[];
  agenda: string | null;
};

export type ValidatedInstantMeetingInput = ValidatedMeetingInput & {
  durationMinutes: InstantMeetingDurationMinutes;
};

/**
 * Applies the Meeting creation rules and returns normalised values.
 * Throws `MeetingValidationError` listing every broken rule so a form can show them inline.
 */
export function validateMeetingInput(
  input: MeetingInput,
): ValidatedMeetingInput {
  const { normalized, issues } = checkMeetingRules(input);
  if (issues.length > 0) throw new MeetingValidationError(issues);
  return normalized;
}

/**
 * The Meeting creation rules plus the Instant Meeting rule: the duration must be one of the
 * offered options, and a missing duration means the default. Same error contract.
 */
export function validateInstantMeetingInput(
  input: MeetingInput & { durationMinutes?: number },
): ValidatedInstantMeetingInput {
  const { normalized, issues } = checkMeetingRules(input);
  const durationMinutes =
    input.durationMinutes === undefined
      ? DEFAULT_INSTANT_MEETING_DURATION_MINUTES
      : input.durationMinutes;
  if (!isOfferedDuration(durationMinutes)) {
    issues.push({
      path: "durationMinutes",
      message: "Pick one of the offered durations",
    });
    throw new MeetingValidationError(issues);
  }
  if (issues.length > 0) throw new MeetingValidationError(issues);
  return { ...normalized, durationMinutes };
}

function isOfferedDuration(
  minutes: number,
): minutes is InstantMeetingDurationMinutes {
  const options: readonly number[] = INSTANT_MEETING_DURATION_OPTIONS_MINUTES;
  return options.includes(minutes);
}

/** The title rule on its own, for renaming: trimmed and non-empty. Same error contract. */
export function validateMeetingTitle(title: string): string {
  const { title: normalized, issue } = checkTitleRule(title);
  if (issue) throw new MeetingValidationError([issue]);
  return normalized;
}

/** Checks the rules shared by every kind of Meeting and reports every broken one. */
function checkMeetingRules(input: MeetingInput): {
  normalized: ValidatedMeetingInput;
  issues: MeetingValidationIssue[];
} {
  const issues: MeetingValidationIssue[] = [];

  const { title, issue: titleIssue } = checkTitleRule(input.title);
  if (titleIssue) issues.push(titleIssue);

  const speakers = input.speakers.map((name) => name.trim());
  if (speakers.length < MIN_SPEAKERS || speakers.length > MAX_SPEAKERS) {
    issues.push({
      path: "speakers",
      message: `A Meeting needs ${MIN_SPEAKERS} to ${MAX_SPEAKERS} Speakers`,
    });
  }

  const seen = new Set<string>();
  speakers.forEach((name, index) => {
    if (name.length === 0) {
      issues.push({
        path: `speakers.${index}`,
        message: "Every Speaker needs a name",
      });
      return;
    }
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) {
      issues.push({
        path: `speakers.${index}`,
        message: "Speaker names must be unique",
      });
    }
    seen.add(key);
  });

  const agenda = input.agenda?.trim() ?? "";
  return {
    normalized: { title, speakers, agenda: agenda.length > 0 ? agenda : null },
    issues,
  };
}

function checkTitleRule(raw: string): {
  title: string;
  issue: MeetingValidationIssue | null;
} {
  const title = raw.trim();
  return {
    title,
    issue:
      title.length === 0
        ? { path: "title", message: MEETING_TITLE_REQUIRED_MESSAGE }
        : null,
  };
}
