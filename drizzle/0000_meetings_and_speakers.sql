CREATE TYPE "public"."failed_step" AS ENUM('transcribing', 'summarizing');--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('recording', 'transcribing', 'summarizing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"status" "meeting_status" NOT NULL,
	"failed_step" "failed_step",
	"error_message" text,
	"agenda" text,
	"is_sample" boolean DEFAULT false NOT NULL,
	"is_instant" boolean DEFAULT false NOT NULL,
	"recording_started_at" timestamp with time zone NOT NULL,
	"recording_ended_at" timestamp with time zone,
	"transcript" jsonb,
	"summary" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meetings_failed_step_matches_status" CHECK (("meetings"."status" = 'failed') = ("meetings"."failed_step" is not null))
);
--> statement-breakpoint
CREATE TABLE "speakers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "speakers" ADD CONSTRAINT "speakers_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meetings_created_at_idx" ON "meetings" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "meetings_is_sample_created_at_idx" ON "meetings" USING btree ("is_sample","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "speakers_meeting_id_name_unique" ON "speakers" USING btree ("meeting_id",lower("name"));