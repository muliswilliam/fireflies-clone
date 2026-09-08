import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  ilike,
  isNotNull,
  isNull,
  not,
  sql,
} from "drizzle-orm";

import type { SummarizationProvider } from "@/lib/ai/summarization-provider";
import type { TranscriptionProvider } from "@/lib/ai/transcription-provider";
import type { Db } from "@/lib/db/client";
import {
  actionItems,
  meetings,
  speakers,
  type FailedStep,
  type MeetingStatus,
  type ProcessingStep,
} from "@/lib/db/schema";

import {
  ActionItemNotFoundError,
  DailyCapReachedError,
  MeetingNotFailedError,
  MeetingNotFoundError,
} from "./errors";
import {
  summarizationOutputSchemaFor,
  summarySchema,
  type SummarizationOutput,
} from "./summary";
import {
  targetUtteranceCount,
  transcriptSchema,
  transcriptSchemaFor,
  type Transcript,
} from "./transcript";
import { validateMeetingInput } from "./validation";
import type { z } from "zod";

export type Speaker = typeof speakers.$inferSelect;
export type ActionItem = typeof actionItems.$inferSelect;

/** A Meeting row with its Speakers and Action Items, each in position order. */
export type Meeting = typeof meetings.$inferSelect & {
  speakers: Speaker[];
  actionItems: ActionItem[];
};

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
  summarizationProvider: SummarizationProvider;
  maxMeetingsPerDay: number;
  /** How long one provider call may take before it counts as a failure. Defaults to `PROVIDER_TIMEOUT_MS`. */
  providerTimeoutMs?: number;
  /** Injectable clock so the rolling cap window and Recording times are testable. Defaults to wall time. */
  now?: () => Date;
};

const CAP_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Generous next to the 10 to 25 s a Claude call takes (ADR-0002), but a hung call must not stall a Meeting forever. */
export const PROVIDER_TIMEOUT_MS = 90_000;

/** Serialises cap checks so two concurrent creates cannot both pass at the boundary. */
const CAP_LOCK_KEY = "meetings:daily-cap";

/** One processing run per Meeting at a time, so a duplicate Stop or an eager Retry never pays the provider twice. */
const processLockKey = (id: string) => `meetings:process:${id}`;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * All Meeting behaviour lives here: creation rules, the daily cap, the Recording lifecycle,
 * the processing pipeline, listing and reading. Server actions and route handlers stay thin
 * and call these operations.
 */
export function createMeetingService(db: Db, config: MeetingServiceConfig) {
  const now = config.now ?? (() => new Date());
  const providerTimeoutMs = config.providerTimeoutMs ?? PROVIDER_TIMEOUT_MS;

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

      return {
        ...meeting,
        speakers: sortByPosition(insertedSpeakers),
        actionItems: [],
      };
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

    return afterGuardedUpdate(db, id, updated);
  }

  /**
   * Runs the remaining processing steps for a Meeting, in order: transcribing, then summarizing.
   * This is the only writer of processing Status transitions apart from create, stop and
   * `regenerateSummary`. Idempotent: a Meeting that is not in-flight is returned unchanged.
   * Provider failures never throw; they leave the Meeting `failed` at the step that broke.
   */
  async function processMeeting(id: string): Promise<Meeting> {
    if (!UUID_PATTERN.test(id)) throw new MeetingNotFoundError(id);

    // Each step commits on its own so a client polling the Status sees `summarizing` while
    // the second provider call runs, rather than jumping from `transcribing` to `ready`.
    let meeting = await runStep(id, "transcribing", transcribe);
    if (meeting.status === "summarizing") {
      meeting = await runStep(id, "summarizing", summarize);
    }
    return meeting;
  }

  /** Runs one pipeline step under the Meeting's processing lock, only if the Meeting is at that step. */
  async function runStep(
    id: string,
    status: ProcessingStep,
    step: (tx: Transaction, meeting: Meeting) => Promise<Meeting>,
  ): Promise<Meeting> {
    return db.transaction(async (tx) => {
      // The lock is held for the whole step, provider call included, and released with the
      // transaction. A concurrent run gives up and reports whatever state it can see.
      const { rows } = await tx.execute<{ locked: boolean }>(
        sql`select pg_try_advisory_xact_lock(hashtext(${processLockKey(id)})) as locked`,
      );
      if (!rows[0]?.locked) return requireMeeting(tx, id);

      const meeting = await requireMeeting(tx, id);
      if (meeting.status !== status) return meeting;
      return step(tx, meeting);
    });
  }

  async function transcribe(
    tx: Transaction,
    meeting: Meeting,
  ): Promise<Meeting> {
    if (!meeting.recordingEndedAt) return meeting;
    const durationMs =
      meeting.recordingEndedAt.getTime() - meeting.recordingStartedAt.getTime();

    let transcript: Transcript;
    try {
      transcript = await generateTranscript(meeting, durationMs);
    } catch (error) {
      return markFailed(tx, meeting.id, "transcribing", error);
    }

    const [updated] = await tx
      .update(meetings)
      .set({ status: "summarizing", transcript, updatedAt: now() })
      .where(
        and(
          eq(meetings.id, meeting.id),
          eq(meetings.status, "transcribing"),
          isNull(meetings.transcript),
        ),
      )
      .returning();
    return afterGuardedUpdate(tx, meeting.id, updated);
  }

  /**
   * Replaces the Summary and every Action Item in one transaction, so a reader never sees a
   * new Summary next to old Action Items (or the reverse). Done state on old items is lost.
   */
  async function summarize(
    tx: Transaction,
    meeting: Meeting,
  ): Promise<Meeting> {
    if (!meeting.transcript) {
      return markFailed(
        tx,
        meeting.id,
        "summarizing",
        new Error("Cannot summarize a Meeting that has no Transcript"),
      );
    }

    let output: SummarizationOutput;
    try {
      output = await generateSummary(meeting, meeting.transcript);
    } catch (error) {
      return markFailed(tx, meeting.id, "summarizing", error);
    }

    const [updated] = await tx
      .update(meetings)
      .set({
        status: "ready",
        summary: {
          overview: output.overview,
          keyTakeaways: output.keyTakeaways,
        },
        updatedAt: now(),
      })
      .where(
        and(eq(meetings.id, meeting.id), eq(meetings.status, "summarizing")),
      )
      .returning();
    if (!updated) return requireMeeting(tx, meeting.id);

    await tx.delete(actionItems).where(eq(actionItems.meetingId, meeting.id));
    if (output.actionItems.length > 0) {
      await tx.insert(actionItems).values(
        output.actionItems.map((item, position) => ({
          meetingId: meeting.id,
          ownerSpeakerId: item.ownerSpeakerId,
          text: item.text,
          dueDate: item.dueDate,
          position,
        })),
      );
    }
    return afterGuardedUpdate(tx, meeting.id, updated);
  }

  /** Asks the provider for a Summary and rejects anything that breaks the Summary rules. */
  async function generateSummary(
    meeting: Meeting,
    transcript: Transcript,
  ): Promise<SummarizationOutput> {
    const generated = await withTimeout(
      config.summarizationProvider.summarize({
        title: meeting.title,
        agenda: meeting.agenda,
        speakers: meeting.speakers.map(({ id, name }) => ({ id, name })),
        transcript,
      }),
      providerTimeoutMs,
      "SummarizationProvider",
    );
    return validateProviderOutput(
      "Summary",
      summarizationOutputSchemaFor({
        speakerIds: meeting.speakers.map((speaker) => speaker.id),
      }),
      generated,
    );
  }

  /** Asks the provider for a Transcript and rejects anything that breaks the Transcript rules. */
  async function generateTranscript(
    meeting: Meeting,
    durationMs: number,
  ): Promise<Transcript> {
    const generated = await withTimeout(
      config.transcriptionProvider.generateTranscript({
        title: meeting.title,
        agenda: meeting.agenda,
        speakers: meeting.speakers.map(({ id, name }) => ({ id, name })),
        durationMs,
        targetUtteranceCount: targetUtteranceCount(durationMs),
      }),
      providerTimeoutMs,
      "TranscriptionProvider",
    );
    return validateProviderOutput(
      "Transcript",
      transcriptSchemaFor({
        durationMs,
        speakerIds: meeting.speakers.map((speaker) => speaker.id),
      }),
      generated,
    );
  }

  async function markFailed(
    tx: Executor,
    id: string,
    step: FailedStep,
    error: unknown,
  ): Promise<Meeting> {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Meeting ${id} failed at ${step}:`, error);
    const [updated] = await tx
      .update(meetings)
      .set({
        status: "failed",
        failedStep: step,
        errorMessage: message,
        updatedAt: now(),
      })
      .where(and(eq(meetings.id, id), eq(meetings.status, step)))
      .returning();
    return afterGuardedUpdate(tx, id, updated);
  }

  /** Flips an Action Item between done and not done. */
  async function toggleActionItem(
    meetingId: string,
    actionItemId: string,
  ): Promise<Meeting> {
    if (!UUID_PATTERN.test(actionItemId)) {
      await requireMeeting(db, meetingId);
      throw new ActionItemNotFoundError(meetingId, actionItemId);
    }

    // One transaction, so the returned Meeting shows the flip and nothing that landed after it.
    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(actionItems)
        .set({ done: not(actionItems.done) })
        .where(
          and(
            eq(actionItems.id, actionItemId),
            eq(actionItems.meetingId, meetingId),
          ),
        )
        .returning({ id: actionItems.id });
      const meeting = await requireMeeting(tx, meetingId);
      if (!updated) throw new ActionItemNotFoundError(meetingId, actionItemId);
      return meeting;
    });
  }

  /**
   * Sends a ready Meeting back to `summarizing` so the next `processMeeting` replaces its
   * Summary and Action Items (ADR-0002: the provider call happens after the response).
   * The current Summary stays in place until the replacement lands, so a failed attempt
   * loses nothing. Idempotent: a Meeting that is not ready is returned unchanged.
   */
  async function regenerateSummary(id: string): Promise<Meeting> {
    if (!UUID_PATTERN.test(id)) throw new MeetingNotFoundError(id);

    const [updated] = await db
      .update(meetings)
      .set({ status: "summarizing", updatedAt: now() })
      .where(
        and(
          eq(meetings.id, id),
          eq(meetings.status, "ready"),
          isNotNull(meetings.transcript),
        ),
      )
      .returning();
    return afterGuardedUpdate(db, id, updated);
  }

  /**
   * Sends a failed Meeting back to the step that failed and clears the failure, so the next
   * `processMeeting` resumes there: a Meeting that failed at summarizing keeps its Transcript
   * and never pays for transcription again (ADR-0002). The caller schedules processing next.
   * Unlike `regenerateSummary` this is not idempotent: retrying a Meeting that has not failed
   * is a caller mistake and throws `MeetingNotFailedError`.
   */
  async function retryMeeting(id: string): Promise<Meeting> {
    if (!UUID_PATTERN.test(id)) throw new MeetingNotFoundError(id);

    // One statement, so two Retries racing each other cannot both pass the guard.
    const [updated] = await db
      .update(meetings)
      .set({
        status: sql`${meetings.failedStep}::text::meeting_status`,
        failedStep: null,
        errorMessage: null,
        updatedAt: now(),
      })
      .where(and(eq(meetings.id, id), eq(meetings.status, "failed")))
      .returning();
    if (!updated) {
      const current = await requireMeeting(db, id);
      throw new MeetingNotFailedError(id, current.status);
    }
    return afterGuardedUpdate(db, id, updated);
  }

  /** Returns the Meeting with its Speakers and Action Items, or `null` when `id` is unknown or not a uuid. */
  async function getMeeting(id: string): Promise<Meeting | null> {
    return findMeeting(db, id);
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

  async function findMeeting(
    tx: Executor,
    id: string,
  ): Promise<Meeting | null> {
    if (!UUID_PATTERN.test(id)) return null;

    const meeting = await tx.query.meetings.findFirst({
      where: eq(meetings.id, id),
      with: {
        speakers: { orderBy: asc(speakers.position) },
        actionItems: { orderBy: asc(actionItems.position) },
      },
    });
    return meeting ? validateStoredDocuments(meeting) : null;
  }

  async function requireMeeting(tx: Executor, id: string): Promise<Meeting> {
    const meeting = await findMeeting(tx, id);
    if (!meeting) throw new MeetingNotFoundError(id);
    return meeting;
  }

  /**
   * Resolves a conditional update: the updated row when the guard matched, otherwise the
   * Meeting as it currently is (or not found). Keeps every state transition race-safe.
   */
  async function afterGuardedUpdate(
    tx: Executor,
    id: string,
    updated: typeof meetings.$inferSelect | undefined,
  ): Promise<Meeting> {
    if (!updated) return requireMeeting(tx, id);
    const [speakerList, actionItemList] = await Promise.all([
      tx.query.speakers.findMany({
        where: eq(speakers.meetingId, id),
        orderBy: asc(speakers.position),
      }),
      tx.query.actionItems.findMany({
        where: eq(actionItems.meetingId, id),
        orderBy: asc(actionItems.position),
      }),
    ]);
    return validateStoredDocuments({
      ...updated,
      speakers: speakerList,
      actionItems: actionItemList,
    });
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
    toggleActionItem,
    regenerateSummary,
    retryMeeting,
    getMeeting,
    getMeetingStatus,
    listMeetings,
  };
}

type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Anything queries can run on: the shared handle or an open transaction. */
type Executor = Db | Transaction;

export type MeetingService = ReturnType<typeof createMeetingService>;

/** ADR-0004: JSONB is validated on read as well as write, so a corrupt row fails loudly here. */
function validateStoredDocuments<M extends Meeting>(meeting: M): M {
  if (meeting.transcript !== null) {
    transcriptSchema.parse(meeting.transcript);
  }
  if (meeting.summary !== null) {
    summarySchema.parse(meeting.summary);
  }
  return meeting;
}

/** Runs a provider's answer through its schema; anything the schema rejects is a provider error. */
function validateProviderOutput<T>(
  document: "Transcript" | "Summary",
  schema: { safeParse: (value: unknown) => z.ZodSafeParseResult<T> },
  generated: unknown,
): T {
  const result = schema.safeParse(generated);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(
      `The provider returned an invalid ${document}: ${issue?.message ?? "unknown issue"}`,
    );
  }
  return result.data;
}

/**
 * Gives up on a provider call that has not settled within `ms`. The underlying call is not
 * cancelled (the provider interface has no signal); its late result is simply ignored.
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  provider: "TranscriptionProvider" | "SummarizationProvider",
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`The ${provider} did not answer within ${ms} ms`)),
      ms,
    );
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/** Makes `%`, `_` and `\` match themselves inside a LIKE pattern. */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function sortByPosition(list: Speaker[]): Speaker[] {
  return [...list].sort((a, b) => a.position - b.position);
}
