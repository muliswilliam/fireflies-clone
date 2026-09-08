import { MeetingValidationError, type MeetingValidationIssue } from "./errors";

export const MIN_SPEAKERS = 2;
export const MAX_SPEAKERS = 6;

export type ValidatedMeetingInput = {
  title: string;
  speakers: string[];
  agenda: string | null;
};

/**
 * Applies the Meeting creation rules and returns normalised values.
 * Throws `MeetingValidationError` listing every broken rule so a form can show them inline.
 */
export function validateMeetingInput(input: {
  title: string;
  speakers: string[];
  agenda?: string | null;
}): ValidatedMeetingInput {
  const issues: MeetingValidationIssue[] = [];

  const title = input.title.trim();
  if (title.length === 0) {
    issues.push({ path: "title", message: "Give the Meeting a title" });
  }

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

  if (issues.length > 0) {
    throw new MeetingValidationError(issues);
  }

  const agenda = input.agenda?.trim() ?? "";
  return { title, speakers, agenda: agenda.length > 0 ? agenda : null };
}
