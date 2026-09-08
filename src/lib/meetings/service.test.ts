import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createFakeTranscriptionProvider } from "@/lib/ai/fake-transcription-provider";
import type { TranscriptionProvider } from "@/lib/ai/transcription-provider";
import { createDb } from "@/lib/db/client";
import { meetings } from "@/lib/db/schema";
import {
  DailyCapReachedError,
  MeetingNotFoundError,
  MeetingValidationError,
} from "@/lib/meetings/errors";
import { createMeetingService } from "@/lib/meetings/service";

import { testDatabaseUrl } from "../../../tests/test-database";

const START = new Date("2026-09-08T10:00:00.000Z");

describe("Meeting service", () => {
  const db = createDb(testDatabaseUrl());
  let now = START;
  const service = createMeetingService(db, {
    transcriptionProvider: createFakeTranscriptionProvider(),
    maxMeetingsPerDay: 3,
    now: () => now,
  });

  beforeEach(async () => {
    now = START;
    await db.delete(meetings);
  });

  afterAll(async () => {
    await db.$client.end();
  });

  describe("createMeeting", () => {
    it("starts a Recording and makes the Meeting retrievable with its Speakers", async () => {
      const created = await service.createMeeting({
        title: "Q3 roadmap sync",
        speakers: ["Amara Okafor", "Ben Liu", "Chloe Martin"],
        agenda: "Scope, dates, owners",
      });

      expect(created).toMatchObject({
        title: "Q3 roadmap sync",
        status: "recording",
        agenda: "Scope, dates, owners",
        isSample: false,
        isInstant: false,
        recordingStartedAt: START,
        recordingEndedAt: null,
        transcript: null,
        summary: null,
      });
      expect(
        created.speakers.map(({ name, position }) => ({ name, position })),
      ).toEqual([
        { name: "Amara Okafor", position: 0 },
        { name: "Ben Liu", position: 1 },
        { name: "Chloe Martin", position: 2 },
      ]);
      expect(await service.getMeeting(created.id)).toEqual(created);
    });

    it("trims the title and Speaker names and stores a blank agenda as null", async () => {
      const created = await service.createMeeting({
        title: "  Design review  ",
        speakers: [" Amara ", "Ben"],
        agenda: "   ",
      });

      expect(created.title).toBe("Design review");
      expect(created.agenda).toBeNull();
      expect(created.speakers.map((speaker) => speaker.name)).toEqual([
        "Amara",
        "Ben",
      ]);
    });

    it("rejects an empty title", async () => {
      await expect(
        service.createMeeting({ title: "   ", speakers: ["Amara", "Ben"] }),
      ).rejects.toMatchObject({
        name: "MeetingValidationError",
        issues: [{ path: "title", message: "Give the Meeting a title" }],
      });
    });

    it("rejects fewer than 2 Speakers", async () => {
      await expect(
        service.createMeeting({ title: "Solo", speakers: ["Amara"] }),
      ).rejects.toMatchObject({
        issues: [
          { path: "speakers", message: "A Meeting needs 2 to 6 Speakers" },
        ],
      });
    });

    it("rejects more than 6 Speakers", async () => {
      await expect(
        service.createMeeting({
          title: "Crowd",
          speakers: ["A", "B", "C", "D", "E", "F", "G"],
        }),
      ).rejects.toMatchObject({
        issues: [
          { path: "speakers", message: "A Meeting needs 2 to 6 Speakers" },
        ],
      });
    });

    it("rejects an empty Speaker name and points at the Speaker", async () => {
      await expect(
        service.createMeeting({
          title: "Standup",
          speakers: ["Amara", "  ", "Chloe"],
        }),
      ).rejects.toMatchObject({
        issues: [{ path: "speakers.1", message: "Every Speaker needs a name" }],
      });
    });

    it("rejects duplicate Speaker names regardless of case and points at the repeat", async () => {
      await expect(
        service.createMeeting({
          title: "Standup",
          speakers: ["Amara", "Ben", "amara "],
        }),
      ).rejects.toMatchObject({
        issues: [
          { path: "speakers.2", message: "Speaker names must be unique" },
        ],
      });
    });

    it("reports every broken rule at once", async () => {
      const failure = await service
        .createMeeting({ title: "", speakers: ["Amara", ""] })
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(MeetingValidationError);
      expect((failure as MeetingValidationError).issues).toEqual([
        { path: "title", message: "Give the Meeting a title" },
        { path: "speakers.1", message: "Every Speaker needs a name" },
      ]);
    });
  });

  describe("daily cap", () => {
    const input = { title: "Sync", speakers: ["Amara", "Ben"] };
    const HOUR = 60 * 60 * 1000;

    async function fillCap() {
      for (let i = 0; i < 3; i++) {
        await service.createMeeting(input);
      }
    }

    it("allows Meetings up to the cap and refuses the next one", async () => {
      await fillCap();

      await expect(service.createMeeting(input)).rejects.toBeInstanceOf(
        DailyCapReachedError,
      );
    });

    it("does not count Sample Meetings and never refuses them", async () => {
      await service.createMeeting({ ...input, isSample: true });
      await fillCap();

      await expect(service.createMeeting(input)).rejects.toBeInstanceOf(
        DailyCapReachedError,
      );
      await expect(
        service.createMeeting({ ...input, isSample: true }),
      ).resolves.toMatchObject({ isSample: true });
    });

    it("frees a slot once the oldest Meeting falls out of the 24 hour window", async () => {
      await fillCap();

      now = new Date(START.getTime() + 23 * HOUR);
      await expect(service.createMeeting(input)).rejects.toBeInstanceOf(
        DailyCapReachedError,
      );

      now = new Date(START.getTime() + 24 * HOUR);
      await expect(service.createMeeting(input)).resolves.toMatchObject({
        recordingStartedAt: now,
      });
    });
  });

  describe("stopRecording", () => {
    it("ends the Recording and moves the Meeting to transcribing", async () => {
      const created = await service.createMeeting({
        title: "Standup",
        speakers: ["Amara", "Ben"],
      });
      now = new Date(START.getTime() + 90_000);

      const stopped = await service.stopRecording(created.id);

      expect(stopped).toMatchObject({
        id: created.id,
        status: "transcribing",
        recordingStartedAt: START,
        recordingEndedAt: now,
        transcript: null,
      });
      expect(stopped.speakers).toEqual(created.speakers);
      expect(await service.getMeeting(created.id)).toEqual(stopped);
    });

    it("is a no-op when the Recording has already been stopped", async () => {
      const created = await service.createMeeting({
        title: "Standup",
        speakers: ["Amara", "Ben"],
      });
      now = new Date(START.getTime() + 90_000);
      const first = await service.stopRecording(created.id);

      now = new Date(START.getTime() + 120_000);
      const second = await service.stopRecording(created.id);

      expect(second).toEqual(first);
    });

    it("throws MeetingNotFoundError for an unknown Meeting", async () => {
      await expect(
        service.stopRecording("00000000-0000-4000-8000-000000000000"),
      ).rejects.toBeInstanceOf(MeetingNotFoundError);
      await expect(service.stopRecording("nope")).rejects.toBeInstanceOf(
        MeetingNotFoundError,
      );
    });
  });

  describe("processMeeting", () => {
    async function stoppedMeeting(durationMs = 10 * 60_000) {
      const created = await service.createMeeting({
        title: "Q3 roadmap sync",
        speakers: ["Amara", "Ben", "Chloe"],
        agenda: "Confirm priorities, pick a launch date",
      });
      now = new Date(START.getTime() + durationMs);
      return service.stopRecording(created.id);
    }

    it("transcribes a stopped Recording and marks the Meeting ready", async () => {
      const stopped = await stoppedMeeting();

      const processed = await service.processMeeting(stopped.id);

      expect(processed.status).toBe("ready");
      expect(processed.failedStep).toBeNull();
      expect(processed.errorMessage).toBeNull();
      expect(processed.transcript).not.toBeNull();
      expect(await service.getMeeting(stopped.id)).toEqual(processed);
    });

    it("sizes the Transcript to the Recording and keeps every Utterance inside it", async () => {
      const stopped = await stoppedMeeting(10 * 60_000);

      const { transcript, speakers } = await service.processMeeting(stopped.id);

      expect(transcript!.utterances).toHaveLength(50);
      const speakerIds = new Set(speakers.map((speaker) => speaker.id));
      let previousStart = 0;
      for (const utterance of transcript!.utterances) {
        expect(speakerIds.has(utterance.speakerId)).toBe(true);
        expect(utterance.startMs).toBeGreaterThanOrEqual(previousStart);
        expect(utterance.endMs).toBeGreaterThanOrEqual(utterance.startMs);
        expect(utterance.endMs).toBeLessThanOrEqual(10 * 60_000);
        previousStart = utterance.startMs;
      }
    });

    it("clamps a very short Recording to 8 Utterances", async () => {
      const stopped = await stoppedMeeting(3_000);

      const { transcript } = await service.processMeeting(stopped.id);

      expect(transcript!.utterances).toHaveLength(8);
    });

    it("does nothing the second time it is called", async () => {
      const stopped = await stoppedMeeting();
      const first = await service.processMeeting(stopped.id);

      now = new Date(now.getTime() + 60_000);
      const second = await service.processMeeting(stopped.id);

      expect(second).toEqual(first);
    });

    it("runs the provider once when two runs race for the same Meeting", async () => {
      let calls = 0;
      const counting: TranscriptionProvider = {
        generateTranscript: async (input) => {
          calls += 1;
          await new Promise((resolve) => setTimeout(resolve, 50));
          return createFakeTranscriptionProvider().generateTranscript(input);
        },
      };
      const racing = createMeetingService(db, {
        transcriptionProvider: counting,
        maxMeetingsPerDay: 3,
        now: () => now,
      });
      const stopped = await stoppedMeeting();

      const results = await Promise.all([
        racing.processMeeting(stopped.id),
        racing.processMeeting(stopped.id),
      ]);

      expect(calls).toBe(1);
      expect(results.some((meeting) => meeting.status === "ready")).toBe(true);
      await expect(service.getMeeting(stopped.id)).resolves.toMatchObject({
        status: "ready",
      });
    });

    it("does nothing while the Recording is still running", async () => {
      const created = await service.createMeeting({
        title: "Standup",
        speakers: ["Amara", "Ben"],
      });

      const result = await service.processMeeting(created.id);

      expect(result).toEqual(created);
    });

    it("throws MeetingNotFoundError for an unknown Meeting", async () => {
      await expect(
        service.processMeeting("00000000-0000-4000-8000-000000000000"),
      ).rejects.toBeInstanceOf(MeetingNotFoundError);
    });

    it("marks the Meeting failed at transcribing when the provider throws", async () => {
      const broken: TranscriptionProvider = {
        generateTranscript: async () => {
          throw new Error("Claude is unavailable");
        },
      };
      const failing = createMeetingService(db, {
        transcriptionProvider: broken,
        maxMeetingsPerDay: 3,
        now: () => now,
      });
      const stopped = await stoppedMeeting();

      const processed = await failing.processMeeting(stopped.id);

      expect(processed).toMatchObject({
        status: "failed",
        failedStep: "transcribing",
        errorMessage: "Claude is unavailable",
        transcript: null,
      });
      expect(await service.getMeeting(stopped.id)).toEqual(processed);
    });

    it("marks the Meeting failed when the provider returns a malformed Transcript", async () => {
      const malformed: TranscriptionProvider = {
        generateTranscript: async ({ speakers, durationMs }) => ({
          utterances: [
            {
              speakerId: speakers[0].id,
              startMs: 0,
              endMs: durationMs + 1_000,
              text: "Runs past the end",
            },
          ],
        }),
      };
      const failing = createMeetingService(db, {
        transcriptionProvider: malformed,
        maxMeetingsPerDay: 3,
        now: () => now,
      });
      const stopped = await stoppedMeeting();

      const processed = await failing.processMeeting(stopped.id);

      expect(processed.status).toBe("failed");
      expect(processed.failedStep).toBe("transcribing");
      expect(processed.errorMessage).toMatch(/Transcript/);
      expect(processed.transcript).toBeNull();
    });
  });

  describe("getMeetingStatus", () => {
    it("reports the Status without loading the rest of the Meeting", async () => {
      const created = await service.createMeeting({
        title: "Standup",
        speakers: ["Amara", "Ben"],
      });

      await expect(service.getMeetingStatus(created.id)).resolves.toEqual({
        status: "recording",
        failedStep: null,
      });

      await service.stopRecording(created.id);
      await service.processMeeting(created.id);

      await expect(service.getMeetingStatus(created.id)).resolves.toEqual({
        status: "ready",
        failedStep: null,
      });
    });

    it("returns null for an unknown Meeting", async () => {
      await expect(
        service.getMeetingStatus("00000000-0000-4000-8000-000000000000"),
      ).resolves.toBeNull();
    });
  });

  describe("getMeeting", () => {
    it("returns null for an unknown id", async () => {
      await expect(
        service.getMeeting("00000000-0000-4000-8000-000000000000"),
      ).resolves.toBeNull();
    });

    it("returns null for an id that is not a uuid", async () => {
      await expect(service.getMeeting("not-a-uuid")).resolves.toBeNull();
    });
  });

  describe("listMeetings", () => {
    async function seedThree() {
      const first = await service.createMeeting({
        title: "Design review",
        speakers: ["Amara", "Ben"],
      });
      now = new Date(START.getTime() + 60_000);
      const second = await service.createMeeting({
        title: "Q3 Roadmap sync",
        speakers: ["Amara", "Ben", "Chloe"],
      });
      now = new Date(START.getTime() + 120_000);
      const third = await service.createMeeting({
        title: "roadmap retro",
        speakers: ["Dev", "Eve", "Fay", "Gus"],
      });
      return { first, second, third };
    }

    it("lists Meetings newest first with their Speaker count and Status", async () => {
      const { first, second, third } = await seedThree();

      const list = await service.listMeetings({});

      expect(
        list.map(({ id, title, status, speakerCount }) => ({
          id,
          title,
          status,
          speakerCount,
        })),
      ).toEqual([
        {
          id: third.id,
          title: "roadmap retro",
          status: "recording",
          speakerCount: 4,
        },
        {
          id: second.id,
          title: "Q3 Roadmap sync",
          status: "recording",
          speakerCount: 3,
        },
        {
          id: first.id,
          title: "Design review",
          status: "recording",
          speakerCount: 2,
        },
      ]);
    });

    it("filters by a case-insensitive title match, newest first", async () => {
      await seedThree();

      const list = await service.listMeetings({ search: "  ROADMAP " });

      expect(list.map((meeting) => meeting.title)).toEqual([
        "roadmap retro",
        "Q3 Roadmap sync",
      ]);
    });

    it("treats a blank search as no filter", async () => {
      await seedThree();

      await expect(
        service.listMeetings({ search: "   " }),
      ).resolves.toHaveLength(3);
    });

    it("matches wildcard characters literally", async () => {
      await seedThree();

      await expect(service.listMeetings({ search: "%" })).resolves.toEqual([]);
      await expect(service.listMeetings({ search: "_" })).resolves.toEqual([]);
    });

    it("returns an empty list when nothing matches", async () => {
      await seedThree();

      await expect(service.listMeetings({ search: "budget" })).resolves.toEqual(
        [],
      );
    });
  });
});
