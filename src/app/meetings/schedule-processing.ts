import "server-only";

import { after } from "next/server";

import { MeetingNotFoundError, type MeetingService } from "@/lib/meetings";

/**
 * Runs `processMeeting` after the current response has been sent (ADR-0002), so the action
 * that moved a Meeting into the pipeline returns at once and the client watches the Status.
 */
export function scheduleProcessing(service: MeetingService, meetingId: string) {
  after(async () => {
    try {
      await service.processMeeting(meetingId);
    } catch (error) {
      if (error instanceof MeetingNotFoundError) {
        // Deleted while its provider call was running; there is nothing left to update.
        console.warn(`Meeting ${meetingId} was deleted while processing`);
        return;
      }
      // Otherwise processMeeting only throws on infrastructure failure; the Meeting stays
      // in-flight until someone retries (ADR-0002 accepts this).
      console.error(`Processing Meeting ${meetingId} did not complete`, error);
    }
  });
}
