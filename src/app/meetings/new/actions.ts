"use server";

import { redirect } from "next/navigation";

import {
  DailyCapReachedError,
  getMeetingService,
  MeetingValidationError,
  type Meeting,
} from "@/lib/meetings";

import { scheduleProcessing } from "../schedule-processing";
import { isCreateIntent, type CreateMeetingFormState } from "./form-state";

/**
 * Thin: reads the form, calls the Meeting service, redirects to the new Meeting. Which submit
 * button was pressed decides between starting a live Recording and an Instant Meeting; the
 * latter is already past Recording, so processing is scheduled before the redirect (ADR-0002).
 */
export async function createMeetingAction(
  _previous: CreateMeetingFormState,
  formData: FormData,
): Promise<CreateMeetingFormState> {
  const intent = formData.get("intent");
  const input = {
    title: String(formData.get("title") ?? ""),
    speakers: formData.getAll("speakers").map(String),
    agenda: String(formData.get("agenda") ?? ""),
  };
  const service = getMeetingService();

  let meeting: Meeting;
  try {
    if (isCreateIntent(intent) && intent === "instant") {
      const duration = formData.get("durationMinutes");
      meeting = await service.createInstantMeeting({
        ...input,
        durationMinutes: duration === null ? undefined : Number(duration),
      });
      scheduleProcessing(service, meeting.id);
    } else {
      meeting = await service.createMeeting(input);
    }
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

  redirect(`/meetings/${meeting.id}`);
}
