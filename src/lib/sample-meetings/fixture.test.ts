import { describe, expect, it } from "vitest";

import {
  loadSampleMeetingFixtures,
  parseSampleMeetingFixture,
} from "./fixture";

describe("Sample Meeting fixtures", () => {
  it("ships two or three valid fixtures with unique ids", () => {
    const fixtures = loadSampleMeetingFixtures();

    expect(fixtures.length).toBeGreaterThanOrEqual(2);
    expect(fixtures.length).toBeLessThanOrEqual(3);
    expect(new Set(fixtures.map((fixture) => fixture.id)).size).toBe(
      fixtures.length,
    );
    for (const fixture of fixtures) {
      expect(fixture.transcript.utterances.length).toBeGreaterThan(0);
      expect(fixture.summary.keyTakeaways.length).toBeGreaterThan(0);
      expect(fixture.actionItems.length).toBeGreaterThan(0);
    }
  });

  it("gives every Speaker the floor at least once in every fixture", () => {
    for (const fixture of loadSampleMeetingFixtures()) {
      const spoke = new Set(
        fixture.transcript.utterances.map((utterance) => utterance.speakerId),
      );
      for (const speaker of fixture.speakers) {
        expect(spoke.has(speaker.id), `${speaker.name} never speaks`).toBe(
          true,
        );
      }
    }
  });

  it("rejects an Utterance attributed to a Speaker who is not in the Meeting", () => {
    const [fixture] = loadSampleMeetingFixtures();
    const stranger = "00000000-0000-4000-8000-000000000000";
    const broken = {
      ...fixture,
      transcript: {
        utterances: [
          { ...fixture.transcript.utterances[0], speakerId: stranger },
        ],
      },
    };

    expect(() => parseSampleMeetingFixture(broken)).toThrow(
      /transcript\.utterances\[0\]\.speakerId/,
    );
  });

  it("rejects an Utterance that runs past the end of the Recording", () => {
    const [fixture] = loadSampleMeetingFixtures();
    const broken = {
      ...fixture,
      recordingEndedAt: new Date(
        Date.parse(fixture.recordingStartedAt) + 1_000,
      ).toISOString(),
    };

    expect(() => parseSampleMeetingFixture(broken)).toThrow(
      /runs past the end of the Recording/,
    );
  });

  it("rejects an Action Item owned by a Speaker who is not in the Meeting", () => {
    const [fixture] = loadSampleMeetingFixtures();
    const stranger = "00000000-0000-4000-8000-000000000000";
    const broken = {
      ...fixture,
      actionItems: [{ ...fixture.actionItems[0], ownerSpeakerId: stranger }],
    };

    expect(() => parseSampleMeetingFixture(broken)).toThrow(
      /actionItems\[0\]\.ownerSpeakerId/,
    );
  });

  it("rejects duplicate Speaker names regardless of case", () => {
    const [fixture] = loadSampleMeetingFixtures();
    const [first, second, ...rest] = fixture.speakers;
    const broken = {
      ...fixture,
      speakers: [first, { ...second, name: first.name.toUpperCase() }, ...rest],
    };

    expect(() => parseSampleMeetingFixture(broken)).toThrow(
      /Speaker names must be unique/,
    );
  });
});
