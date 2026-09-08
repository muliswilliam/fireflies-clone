"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { after } from "next/server";

import {
  ActionItemNotFoundError,
  getMeetingService,
  MeetingNotFoundError,
  type MeetingService,
} from "@/lib/meetings";

/**
 * Thin: ends the Recording, schedules processing to continue after the response (ADR-0002),
 * and returns immediately so the client can show the Meeting moving through its Status.
 */
export async function stopRecordingAction(meetingId: string): Promise<void> {
  const service = getMeetingService();
  try {
    await service.stopRecording(meetingId);
  } catch (error) {
    if (error instanceof MeetingNotFoundError) notFound();
    throw error;
  }
  scheduleProcessing(service, meetingId);
}

/** Flips one Action Item and re-renders the Meeting page with the result. */
export async function toggleActionItemAction(
  meetingId: string,
  actionItemId: string,
): Promise<void> {
  try {
    await getMeetingService().toggleActionItem(meetingId, actionItemId);
  } catch (error) {
    if (error instanceof MeetingNotFoundError) notFound();
    // The item vanished under the user (a regenerate landed meanwhile); the refreshed page explains.
    if (!(error instanceof ActionItemNotFoundError)) throw error;
  }
  revalidatePath(`/meetings/${meetingId}`);
}

/**
 * Sends the Meeting back to summarizing and schedules the new Summary after the response,
 * exactly like Stop does for the whole pipeline (ADR-0002).
 */
export async function regenerateSummaryAction(
  meetingId: string,
): Promise<void> {
  const service = getMeetingService();
  try {
    await service.regenerateSummary(meetingId);
  } catch (error) {
    if (error instanceof MeetingNotFoundError) notFound();
    throw error;
  }
  scheduleProcessing(service, meetingId);
  revalidatePath(`/meetings/${meetingId}`);
}

function scheduleProcessing(service: MeetingService, meetingId: string) {
  after(async () => {
    try {
      await service.processMeeting(meetingId);
    } catch (error) {
      // processMeeting only throws on infrastructure failure; the Meeting stays in-flight
      // until someone retries (ADR-0002 accepts this).
      console.error(`Processing Meeting ${meetingId} did not complete`, error);
    }
  });
}
