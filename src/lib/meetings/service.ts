import { and, asc, count, desc, eq, gt, ilike, sql } from "drizzle-orm";

import type { Db } from "@/lib/db/client";
import { meetings, speakers, type MeetingStatus } from "@/lib/db/schema";

import { DailyCapReachedError } from "./errors";
import { validateMeetingInput } from "./validation";

export type Speaker = typeof speakers.$inferSelect;

/** A Meeting row with its Speakers in position order. */
export type Meeting = typeof meetings.$inferSelect & { speakers: Speaker[] };

/** Enough to render a row in the Meetings list without loading Transcripts or Summaries. */
export type MeetingListItem = {
  id: string;
  title: string;
  status: MeetingStatus;
  isSample: boolean;
  recordingStartedAt: Date;
  recordingEndedAt: Date | null;
  createdAt: Date;
  speakerCount: number;
};

export type ListMeetingsInput = {
  /** Case-insensitive substring match on the title. Blank means no filter. */
  search?: string | null;
};

export type CreateMeetingInput = {
  title: string;
  /** Speaker names in display order; 2 to 6, unique and non-empty. */
  speakers: string[];
  agenda?: string | null;
  /** Sample Meetings are seeded content: they neither count toward nor are refused by the daily cap. */
  isSample?: boolean;
};

export type MeetingServiceConfig = {
  maxMeetingsPerDay: number;
  /** Injectable clock so the rolling cap window is testable. Defaults to wall time. */
  now?: () => Date;
};

const CAP_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Serialises cap checks so two concurrent creates cannot both pass at the boundary. */
const CAP_LOCK_KEY = "meetings:daily-cap";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * All Meeting behaviour lives here: creation rules, the daily cap, listing and reading.
 * Server actions and route handlers stay thin and call these operations.
 */
export function createMeetingService(db: Db, config: MeetingServiceConfig) {
  const now = config.now ?? (() => new Date());

  async function createMeeting(input: CreateMeetingInput): Promise<Meeting> {
    const normalized = validateMeetingInput(input);
    const isSample = input.isSample ?? false;
    const startedAt = now();

    return db.transaction(async (tx) => {
      if (!isSample) {
        await assertBelowDailyCap(tx, startedAt);
      }

      const [meeting] = await tx
        .insert(meetings)
        .values({
          title: normalized.title,
          status: "recording",
          agenda: normalized.agenda,
          isSample,
          recordingStartedAt: startedAt,
          createdAt: startedAt,
          updatedAt: startedAt,
        })
        .returning();

      const insertedSpeakers = await tx
        .insert(speakers)
        .values(
          normalized.speakers.map((name, position) => ({
            meetingId: meeting.id,
            name,
            position,
          })),
        )
        .returning();

      return { ...meeting, speakers: sortByPosition(insertedSpeakers) };
    });
  }

  /** Returns the Meeting with its Speakers, or `null` when `id` is unknown or not a uuid. */
  async function getMeeting(id: string): Promise<Meeting | null> {
    if (!UUID_PATTERN.test(id)) return null;

    const meeting = await db.query.meetings.findFirst({
      where: eq(meetings.id, id),
      with: { speakers: { orderBy: asc(speakers.position) } },
    });
    return meeting ?? null;
  }

  /** Newest first. */
  async function listMeetings(
    input: ListMeetingsInput,
  ): Promise<MeetingListItem[]> {
    const search = input.search?.trim() ?? "";
    const titleMatches =
      search.length > 0
        ? ilike(meetings.title, `%${escapeLikePattern(search)}%`)
        : undefined;

    return db
      .select({
        id: meetings.id,
        title: meetings.title,
        status: meetings.status,
        isSample: meetings.isSample,
        recordingStartedAt: meetings.recordingStartedAt,
        recordingEndedAt: meetings.recordingEndedAt,
        createdAt: meetings.createdAt,
        speakerCount: count(speakers.id),
      })
      .from(meetings)
      .leftJoin(speakers, eq(speakers.meetingId, meetings.id))
      .where(titleMatches)
      .groupBy(meetings.id)
      .orderBy(desc(meetings.createdAt), desc(meetings.id));
  }

  /** ADR-0005: non-sample Meetings created in the trailing 24 h must stay below the cap. */
  async function assertBelowDailyCap(tx: Transaction, at: Date) {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${CAP_LOCK_KEY}))`,
    );

    const windowStart = new Date(at.getTime() - CAP_WINDOW_MS);
    const [{ created }] = await tx
      .select({ created: count() })
      .from(meetings)
      .where(
        and(eq(meetings.isSample, false), gt(meetings.createdAt, windowStart)),
      );

    if (created >= config.maxMeetingsPerDay) {
      throw new DailyCapReachedError(config.maxMeetingsPerDay);
    }
  }

  return { createMeeting, getMeeting, listMeetings };
}

type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type MeetingService = ReturnType<typeof createMeetingService>;

/** Makes `%`, `_` and `\` match themselves inside a LIKE pattern. */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function sortByPosition(list: Speaker[]): Speaker[] {
  return [...list].sort((a, b) => a.position - b.position);
}
