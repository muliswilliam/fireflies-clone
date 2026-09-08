"use server";

import { notFound } from "next/navigation";
import { after } from "next/server";

import { getMeetingService, MeetingNotFoundError } from "@/lib/meetings";

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
