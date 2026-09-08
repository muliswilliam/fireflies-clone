// Drizzle schema. Tables are introduced by feature tickets:
//   #3 meetings, speakers
//   #5 action_items
// Keep every table exported from this module so drizzle-kit and the
// typed database handle see the same shape.
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { Summary } from "@/lib/meetings/summary";
import type { Transcript } from "@/lib/meetings/transcript";

export const MEETING_STATUSES = [
  "recording",
  "transcribing",
  "summarizing",
  "ready",
  "failed",
] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

/** Processing steps that can fail; a failed Meeting is retried from this step. */
export const FAILED_STEPS = ["transcribing", "summarizing"] as const;
export type FailedStep = (typeof FAILED_STEPS)[number];

export const meetingStatusEnum = pgEnum("meeting_status", MEETING_STATUSES);
export const failedStepEnum = pgEnum("failed_step", FAILED_STEPS);

export const meetings = pgTable(
  "meetings",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    title: text("title").notNull(),
    status: meetingStatusEnum("status").notNull(),
    failedStep: failedStepEnum("failed_step"),
    errorMessage: text("error_message"),
    agenda: text("agenda"),
    isSample: boolean("is_sample").notNull().default(false),
    isInstant: boolean("is_instant").notNull().default(false),
    recordingStartedAt: timestamp("recording_started_at", {
      withTimezone: true,
    }).notNull(),
    recordingEndedAt: timestamp("recording_ended_at", { withTimezone: true }),
    // Both documents are validated by Zod at the service boundary (ADR-0004).
    transcript: jsonb("transcript").$type<Transcript>(),
    summary: jsonb("summary").$type<Summary>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("meetings_created_at_idx").on(table.createdAt.desc()),
    // Serves the daily cap query: non-sample Meetings in a time window.
    index("meetings_is_sample_created_at_idx").on(
      table.isSample,
      table.createdAt,
    ),
    // A failed Meeting always knows which step failed, and only a failed one does.
    check(
      "meetings_failed_step_matches_status",
      sql`(${table.status} = 'failed') = (${table.failedStep} is not null)`,
    ),
  ],
);

export const speakers = pgTable(
  "speakers",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Order within the Meeting; also keys the Speaker's colour. */
    position: integer("position").notNull(),
  },
  (table) => [
    // Names are unique per Meeting regardless of case, matching the service rule.
    uniqueIndex("speakers_meeting_id_name_unique").on(
      table.meetingId,
      sql`lower(${table.name})`,
    ),
  ],
);

/**
 * Action Items are rows rather than part of the Summary document because each one is toggled
 * on its own and its owner is a foreign key to a Speaker (ADR-0004). Membership of the owner in
 * this Meeting's Speakers is a service rule; the FK alone only guarantees the Speaker exists.
 */
export const actionItems = pgTable(
  "action_items",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    ownerSpeakerId: uuid("owner_speaker_id").references(() => speakers.id, {
      onDelete: "set null",
    }),
    text: text("text").notNull(),
    /** Free-form text as the model wrote it ("Friday", "2026-10-01"); never parsed. */
    dueDate: text("due_date"),
    done: boolean("done").notNull().default(false),
    /** Order within the Meeting's Action Items. */
    position: integer("position").notNull(),
  },
  (table) => [
    index("action_items_meeting_id_position_idx").on(
      table.meetingId,
      table.position,
    ),
  ],
);

export const meetingsRelations = relations(meetings, ({ many }) => ({
  speakers: many(speakers),
  actionItems: many(actionItems),
}));

export const speakersRelations = relations(speakers, ({ one }) => ({
  meeting: one(meetings, {
    fields: [speakers.meetingId],
    references: [meetings.id],
  }),
}));

export const actionItemsRelations = relations(actionItems, ({ one }) => ({
  meeting: one(meetings, {
    fields: [actionItems.meetingId],
    references: [meetings.id],
  }),
  owner: one(speakers, {
    fields: [actionItems.ownerSpeakerId],
    references: [speakers.id],
  }),
}));
