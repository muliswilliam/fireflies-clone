import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createDb } from "@/lib/db/client";
import { meetings } from "@/lib/db/schema";
import {
  DailyCapReachedError,
  MeetingValidationError,
} from "@/lib/meetings/errors";
import { createMeetingService } from "@/lib/meetings/service";

import { testDatabaseUrl } from "../../../tests/test-database";

const START = new Date("2026-09-08T10:00:00.000Z");

describe("Meeting service", () => {
  const db = createDb(testDatabaseUrl());
  let now = START;
  const service = createMeetingService(db, {
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
