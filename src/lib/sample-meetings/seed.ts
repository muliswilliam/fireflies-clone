import { eq, sql } from "drizzle-orm";

import { createDb, type Db, type Transaction } from "@/lib/db/client";
import { actionItems, meetings, speakers } from "@/lib/db/schema";

import {
  loadSampleMeetingFixtures,
  type SampleMeetingFixture,
} from "./fixture";

export type SeededSampleMeeting = { id: string; title: string };

/** Serialises seeders, so two containers starting together take turns rather than colliding. */
const SEED_LOCK_KEY = "meetings:seed-samples";

/**
 * Puts every checked-in Sample Meeting in the database, keyed by its fixture id, so the
 * workspace is never empty. Idempotent: each run resets a Sample Meeting to its fixture
 * (title, Speakers, Transcript, Summary, Action Items with done cleared) and brings back
 * one that was deleted. Runs on every container start after migrations and as `pnpm db:seed`.
 * Meetings that are not Sample Meetings are never touched.
 */
export async function seedSampleMeetings(
  db: Db,
): Promise<SeededSampleMeeting[]> {
  const fixtures = loadSampleMeetingFixtures();
  for (const fixture of fixtures) {
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${SEED_LOCK_KEY}))`,
      );
      await resetSampleMeeting(tx, fixture);
    });
  }
  return fixtures.map(({ id, title }) => ({ id, title }));
}

/** Connects to `url`, seeds the Sample Meetings, and releases the connection. */
export async function seedDatabase(
  url: string,
): Promise<SeededSampleMeeting[]> {
  const db = createDb(url);
  try {
    return await seedSampleMeetings(db);
  } finally {
    await db.$client.end();
  }
}

/**
 * One Sample Meeting, made to match its fixture exactly. The Meeting row is upserted on its
 * id; its Speakers and Action Items are replaced rather than diffed, and come back with their
 * fixture ids, so the rows are the same after every run.
 */
async function resetSampleMeeting(
  tx: Transaction,
  fixture: SampleMeetingFixture,
) {
  const recordingStartedAt = new Date(fixture.recordingStartedAt);
  const recordingEndedAt = new Date(fixture.recordingEndedAt);
  const row = {
    title: fixture.title,
    agenda: fixture.agenda,
    status: "ready",
    failedStep: null,
    errorMessage: null,
    isSample: true,
    isInstant: false,
    recordingStartedAt,
    recordingEndedAt,
    transcript: fixture.transcript,
    summary: fixture.summary,
    createdAt: recordingStartedAt,
    updatedAt: recordingEndedAt,
  } satisfies Omit<typeof meetings.$inferInsert, "id">;

  await tx
    .insert(meetings)
    .values({ id: fixture.id, ...row })
    .onConflictDoUpdate({ target: meetings.id, set: row });

  // Action Items reference Speakers, so they go first and come back last.
  await tx.delete(actionItems).where(eq(actionItems.meetingId, fixture.id));
  await tx.delete(speakers).where(eq(speakers.meetingId, fixture.id));

  await tx.insert(speakers).values(
    fixture.speakers.map((speaker, position) => ({
      id: speaker.id,
      meetingId: fixture.id,
      name: speaker.name,
      position,
    })),
  );

  if (fixture.actionItems.length > 0) {
    await tx.insert(actionItems).values(
      fixture.actionItems.map((item, position) => ({
        id: item.id,
        meetingId: fixture.id,
        ownerSpeakerId: item.ownerSpeakerId,
        text: item.text,
        dueDate: item.dueDate,
        done: false,
        position,
      })),
    );
  }
}
