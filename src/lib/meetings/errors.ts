export type MeetingValidationIssue = {
  /** Dot path into the input, for example `title` or `speakers.2`. */
  path: string;
  message: string;
};

/** The input to a Meeting operation broke a domain rule. Carries per-field issues for inline display. */
export class MeetingValidationError extends Error {
  readonly issues: MeetingValidationIssue[];

  constructor(issues: MeetingValidationIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "));
    this.name = "MeetingValidationError";
    this.issues = issues;
  }
}

/** The global cap on Meetings created in a rolling 24 hours has been reached (ADR-0005). */
export class DailyCapReachedError extends Error {
  readonly maxMeetingsPerDay: number;

  constructor(maxMeetingsPerDay: number) {
    super(
      `The daily cap of ${maxMeetingsPerDay} Meetings per 24 hours has been reached`,
    );
    this.name = "DailyCapReachedError";
    this.maxMeetingsPerDay = maxMeetingsPerDay;
  }
}

/** The Meeting an operation was asked to act on does not exist. */
export class MeetingNotFoundError extends Error {
  readonly meetingId: string;

  constructor(meetingId: string) {
    super(`Meeting ${meetingId} was not found`);
    this.name = "MeetingNotFoundError";
    this.meetingId = meetingId;
  }
}

/** The Action Item an operation was asked to act on does not exist on that Meeting. */
export class ActionItemNotFoundError extends Error {
  readonly meetingId: string;
  readonly actionItemId: string;

  constructor(meetingId: string, actionItemId: string) {
    super(`Action Item ${actionItemId} was not found on Meeting ${meetingId}`);
    this.name = "ActionItemNotFoundError";
    this.meetingId = meetingId;
    this.actionItemId = actionItemId;
  }
}
