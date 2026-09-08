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
    // Validated by Zod at the service boundary; shapes are owned by #4 and #5.
    transcript: jsonb("transcript"),
    summary: jsonb("summary"),
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

export const meetingsRelations = relations(meetings, ({ many }) => ({
  speakers: many(speakers),
}));

export const speakersRelations = relations(speakers, ({ one }) => ({
  meeting: one(meetings, {
    fields: [speakers.meetingId],
    references: [meetings.id],
  }),
}));
