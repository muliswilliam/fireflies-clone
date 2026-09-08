import "server-only";

import { getSummarizationProvider, getTranscriptionProvider } from "@/lib/ai";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";

import { createMeetingService, type MeetingService } from "./service";

export {
  ActionItemNotFoundError,
  DailyCapReachedError,
  MeetingNotFoundError,
  MeetingValidationError,
  type MeetingValidationIssue,
} from "./errors";
export type {
  ActionItem,
  CreateMeetingInput,
  ListMeetingsInput,
  Meeting,
  MeetingListItem,
  MeetingService,
  MeetingStatusReport,
  Speaker,
} from "./service";
export type { Summary } from "./summary";
export type { Transcript, Utterance } from "./transcript";
export { MAX_SPEAKERS, MIN_SPEAKERS } from "./validation";

const globalForService = globalThis as typeof globalThis & {
  __fireflyMeetingService?: MeetingService;
};

/** Process-wide Meeting service over the shared database handle and environment config. */
export function getMeetingService(): MeetingService {
  globalForService.__fireflyMeetingService ??= createMeetingService(getDb(), {
    transcriptionProvider: getTranscriptionProvider(),
    summarizationProvider: getSummarizationProvider(),
    maxMeetingsPerDay: getEnv().MAX_MEETINGS_PER_DAY,
  });
  return globalForService.__fireflyMeetingService;
}
