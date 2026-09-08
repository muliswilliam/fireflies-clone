"use server";

import { redirect } from "next/navigation";

import {
  DailyCapReachedError,
  getMeetingService,
  MeetingValidationError,
} from "@/lib/meetings";

import type { CreateMeetingFormState } from "./form-state";

/** Thin: reads the form, calls the Meeting service, redirects to the new Meeting. */
export async function createMeetingAction(
  _previous: CreateMeetingFormState,
  formData: FormData,
): Promise<CreateMeetingFormState> {
  const input = {
    title: String(formData.get("title") ?? ""),
    speakers: formData.getAll("speakers").map(String),
    agenda: String(formData.get("agenda") ?? ""),
  };

  let meetingId: string;
  try {
    const meeting = await getMeetingService().createMeeting(input);
    meetingId = meeting.id;
  } catch (error) {
    if (error instanceof MeetingValidationError) {
      return { issues: error.issues, formError: null };
    }
    if (error instanceof DailyCapReachedError) {
      return {
        issues: [],
        formError: `Firefly Notes has reached its limit of ${error.maxMeetingsPerDay} new meetings in 24 hours. Please try again later.`,
      };
    }
    throw error;
  }

  redirect(`/meetings/${meetingId}`);
}
