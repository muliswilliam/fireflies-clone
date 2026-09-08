import { and, asc, count, desc, eq, gt, ilike, isNull, sql } from "drizzle-orm";

import type { TranscriptionProvider } from "@/lib/ai/transcription-provider";
import type { Db } from "@/lib/db/client";
import {
  meetings,
  speakers,
  type FailedStep,
  type MeetingStatus,
} from "@/lib/db/schema";

import { DailyCapReachedError, MeetingNotFoundError } from "./errors";
import {
  targetUtteranceCount,
  transcriptSchema,
  transcriptSchemaFor,
  type Transcript,
} from "./transcript";
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

/** What a client polling for progress needs and nothing more. */
export type MeetingStatusReport = {
  status: MeetingStatus;
  failedStep: FailedStep | null;
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
  transcriptionProvider: TranscriptionProvider;
  maxMeetingsPerDay: number;
  /** Injectable clock so the rolling cap window and Recording times are testable. Defaults to wall time. */
  now?: () => Date;
};

const CAP_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Serialises cap checks so two concurrent creates cannot both pass at the boundary. */
const CAP_LOCK_KEY = "meetings:daily-cap";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * All Meeting behaviour lives here: creation rules, the daily cap, the Recording lifecycle,
 * the processing pipeline, listing and reading. Server actions and route handlers stay thin
 * and call these operations.
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

  /**
   * Ends the Recording: sets `recording_ended_at` and moves the Meeting to `transcribing`.
   * Idempotent: a Meeting whose Recording has already ended is returned unchanged.
   * The caller is expected to schedule `processMeeting` next (ADR-0002).
   */
  async function stopRecording(id: string): Promise<Meeting> {
    if (!UUID_PATTERN.test(id)) throw new MeetingNotFoundError(id);
    const endedAt = now();

    const [updated] = await db
      .update(meetings)
      .set({
        status: "transcribing",
        recordingEndedAt: endedAt,
        updatedAt: endedAt,
      })
      .where(and(eq(meetings.id, id), eq(meetings.status, "recording")))
      .returning();

    return updated ? withSpeakers(updated) : requireMeeting(id);
  }

  /**
   * Runs the remaining processing steps for a Meeting, in order. Today that is transcription;
   * #5 adds summarization. This is the only writer of processing Status transitions.
   * Idempotent: a Meeting that is not in-flight is returned unchanged.
   * Provider failures never throw; they leave the Meeting `failed` at the step that broke.
   */
  async function processMeeting(id: string): Promise<Meeting> {
    const meeting = await requireMeeting(id);
    if (meeting.status !== "transcribing") return meeting;
    return transcribe(meeting);
  }

  async function transcribe(meeting: Meeting): Promise<Meeting> {
    const durationMs =
      meeting.recordingEndedAt!.getTime() -
      meeting.recordingStartedAt.getTime();

    let transcript: Transcript;
    try {
      transcript = await generateTranscript(meeting, durationMs);
    } catch (error) {
      return markFailed(meeting.id, "transcribing", error);
    }

    // Only the first writer wins if two runs race; the loser reads what the winner stored.
    const [updated] = await db
      .update(meetings)
      .set({ status: "ready", transcript, updatedAt: now() })
      .where(
        and(
          eq(meetings.id, meeting.id),
          eq(meetings.status, "transcribing"),
          isNull(meetings.transcript),
        ),
      )
      .returning();
    return updated ? withSpeakers(updated) : requireMeeting(meeting.id);
  }

  /** Asks the provider for a Transcript and rejects anything that breaks the Transcript rules. */
  async function generateTranscript(
    meeting: Meeting,
    durationMs: number,
  ): Promise<Transcript> {
    const generated = await config.transcriptionProvider.generateTranscript({
      title: meeting.title,
      agenda: meeting.agenda,
      speakers: meeting.speakers.map(({ id, name }) => ({ id, name })),
      durationMs,
      targetUtteranceCount: targetUtteranceCount(durationMs),
    });
    const result = transcriptSchemaFor({
      durationMs,
      speakerIds: meeting.speakers.map((speaker) => speaker.id),
    }).safeParse(generated);
    if (!result.success) {
      const issue = result.error.issues[0];
      throw new Error(
        `The provider returned an invalid Transcript: ${issue?.message ?? "unknown issue"}`,
      );
    }
    return result.data;
  }

  async function markFailed(
    id: string,
    step: FailedStep,
    error: unknown,
  ): Promise<Meeting> {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Meeting ${id} failed at ${step}:`, error);
    const [updated] = await db
      .update(meetings)
      .set({
        status: "failed",
        failedStep: step,
        errorMessage: message,
        updatedAt: now(),
      })
      .where(and(eq(meetings.id, id), eq(meetings.status, step)))
      .returning();
    return updated ? withSpeakers(updated) : requireMeeting(id);
  }

  /** Returns the Meeting with its Speakers, or `null` when `id` is unknown or not a uuid. */
  async function getMeeting(id: string): Promise<Meeting | null> {
    if (!UUID_PATTERN.test(id)) return null;

    const meeting = await db.query.meetings.findFirst({
      where: eq(meetings.id, id),
      with: { speakers: { orderBy: asc(speakers.position) } },
    });
    return meeting ? validateStoredTranscript(meeting) : null;
  }

  /** Cheap enough to poll every couple of seconds. `null` when `id` is unknown. */
  async function getMeetingStatus(
    id: string,
  ): Promise<MeetingStatusReport | null> {
    if (!UUID_PATTERN.test(id)) return null;

    const [row] = await db
      .select({ status: meetings.status, failedStep: meetings.failedStep })
      .from(meetings)
      .where(eq(meetings.id, id));
    return row ?? null;
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

  async function requireMeeting(id: string): Promise<Meeting> {
    const meeting = await getMeeting(id);
    if (!meeting) throw new MeetingNotFoundError(id);
    return meeting;
  }

  async function withSpeakers(
    row: typeof meetings.$inferSelect,
  ): Promise<Meeting> {
    const list = await db.query.speakers.findMany({
      where: eq(speakers.meetingId, row.id),
      orderBy: asc(speakers.position),
    });
    return validateStoredTranscript({ ...row, speakers: list });
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

  return {
    createMeeting,
    stopRecording,
    processMeeting,
    getMeeting,
    getMeetingStatus,
    listMeetings,
  };
}

type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type MeetingService = ReturnType<typeof createMeetingService>;

/** ADR-0004: JSONB is validated on read as well as write, so a corrupt row fails loudly here. */
function validateStoredTranscript<M extends Meeting>(meeting: M): M {
  if (meeting.transcript !== null) {
    transcriptSchema.parse(meeting.transcript);
  }
  return meeting;
}

/** Makes `%`, `_` and `\` match themselves inside a LIKE pattern. */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function sortByPosition(list: Speaker[]): Speaker[] {
  return [...list].sort((a, b) => a.position - b.position);
}
