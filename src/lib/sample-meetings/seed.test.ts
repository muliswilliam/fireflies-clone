import { asc } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createFakeSummarizationProvider } from "@/lib/ai/fake-summarization-provider";
import { createFakeTranscriptionProvider } from "@/lib/ai/fake-transcription-provider";
import { createDb } from "@/lib/db/client";
import { actionItems, meetings, speakers } from "@/lib/db/schema";
import { DailyCapReachedError } from "@/lib/meetings/errors";
import { createMeetingService } from "@/lib/meetings/service";

import { testDatabaseUrl } from "../../../tests/test-database";
import { loadSampleMeetingFixtures } from "./fixture";
import { seedSampleMeetings } from "./seed";

const NOW = new Date("2026-09-09T10:00:00.000Z");

describe("Sample Meeting seeder", () => {
  const db = createDb(testDatabaseUrl());
  const fixtures = loadSampleMeetingFixtures();
  const service = createMeetingService(db, {
    transcriptionProvider: createFakeTranscriptionProvider(),
    summarizationProvider: createFakeSummarizationProvider(),
    maxMeetingsPerDay: 1,
    now: () => NOW,
  });

  /** Every row in every table, in a stable order, so two database states can be compared whole. */
  async function snapshot() {
    return {
      meetings: await db.select().from(meetings).orderBy(asc(meetings.id)),
      speakers: await db.select().from(speakers).orderBy(asc(speakers.id)),
      actionItems: await db
        .select()
        .from(actionItems)
        .orderBy(asc(actionItems.id)),
    };
  }

  beforeEach(async () => {
    await db.delete(meetings);
  });

  afterAll(async () => {
    await db.$client.end();
  });

  it("seeds every fixture as a ready Sample Meeting with its Speakers, Transcript, Summary and Action Items", async () => {
    const seeded = await seedSampleMeetings(db);

    expect(seeded).toEqual(fixtures.map(({ id, title }) => ({ id, title })));
    for (const fixture of fixtures) {
      const meeting = await service.getMeeting(fixture.id);
      expect(meeting).toMatchObject({
        id: fixture.id,
        title: fixture.title,
        agenda: fixture.agenda,
        status: "ready",
        failedStep: null,
        errorMessage: null,
        isSample: true,
        isInstant: false,
        recordingStartedAt: new Date(fixture.recordingStartedAt),
        recordingEndedAt: new Date(fixture.recordingEndedAt),
        transcript: fixture.transcript,
        summary: fixture.summary,
      });
      expect(
        meeting!.speakers.map(({ id, name, position }) => ({
          id,
          name,
          position,
        })),
      ).toEqual(
        fixture.speakers.map((speaker, position) => ({ ...speaker, position })),
      );
      expect(
        meeting!.actionItems.map(
          ({ id, text, ownerSpeakerId, dueDate, done, position }) => ({
            id,
            text,
            ownerSpeakerId,
            dueDate,
            done,
            position,
          }),
        ),
      ).toEqual(
        fixture.actionItems.map((item, position) => ({
          ...item,
          done: false,
          position,
        })),
      );
    }
  });

  it("lists Sample Meetings like any other Meeting, marked as samples", async () => {
    await seedSampleMeetings(db);

    const list = await service.listMeetings({});

    expect(list).toHaveLength(fixtures.length);
    expect(list.every((item) => item.isSample)).toBe(true);
    expect(list.map((item) => item.id)).toEqual(
      [...fixtures]
        .sort(
          (a, b) =>
            Date.parse(b.recordingStartedAt) - Date.parse(a.recordingStartedAt),
        )
        .map((fixture) => fixture.id),
    );
  });

  it("running twice yields identical rows", async () => {
    await seedSampleMeetings(db);
    const first = await snapshot();

    await seedSampleMeetings(db);

    expect(await snapshot()).toEqual(first);
    expect(first.meetings).toHaveLength(fixtures.length);
  });

  it("restores a deleted Sample Meeting exactly as it was", async () => {
    await seedSampleMeetings(db);
    const before = await snapshot();

    await service.deleteMeeting(fixtures[0].id);
    expect(await service.getMeeting(fixtures[0].id)).toBeNull();
    await seedSampleMeetings(db);

    expect(await snapshot()).toEqual(before);
  });

  it("resets a renamed Sample Meeting and its ticked Action Items back to the fixture", async () => {
    await seedSampleMeetings(db);
    const before = await snapshot();
    const [fixture] = fixtures;

    await service.renameMeeting(fixture.id, "Renamed by a reviewer");
    await service.toggleActionItem(fixture.id, fixture.actionItems[0].id);
    await seedSampleMeetings(db);

    expect(await snapshot()).toEqual(before);
  });

  it("leaves Meetings that are not Sample Meetings alone", async () => {
    const own = await service.createMeeting({
      title: "My own sync",
      speakers: ["Amara", "Ben"],
    });

    await seedSampleMeetings(db);

    expect(await service.getMeeting(own.id)).toEqual(own);
    expect(await service.listMeetings({})).toHaveLength(fixtures.length + 1);
  });

  it("does not count Sample Meetings toward the daily cap", async () => {
    await seedSampleMeetings(db);
    const input = { title: "Sync", speakers: ["Amara", "Ben"] };

    // The cap is 1: the seeded Sample Meetings leave the whole allowance free.
    await expect(service.createMeeting(input)).resolves.toMatchObject({
      isSample: false,
    });
    await expect(service.createMeeting(input)).rejects.toBeInstanceOf(
      DailyCapReachedError,
    );
  });
});
