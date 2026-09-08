import { AlertCircle, Loader2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { BackToMeetingsLink } from "@/components/back-to-meetings-link";
import { MeetingMeta } from "@/components/meetings/meeting-meta";
import { RecordingPanel } from "./recording-panel";
import { SpeakerNumber } from "@/components/meetings/speaker-number";
import {
  MEETING_STATUS_LABELS,
  StatusBadge,
} from "@/components/meetings/status-badge";
import { StatusPoller } from "@/components/meetings/status-poller";
import { StatusStepper } from "@/components/meetings/status-stepper";
import { TranscriptView } from "@/components/meetings/transcript-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMeetingService, type Meeting } from "@/lib/meetings";

export const dynamic = "force-dynamic";

/** Shared between metadata and page so one request loads the Meeting once. */
const loadMeeting = cache((id: string) => getMeetingService().getMeeting(id));

export async function generateMetadata({
  params,
}: PageProps<"/meetings/[id]">): Promise<Metadata> {
  const { id } = await params;
  const meeting = await loadMeeting(id);
  return { title: meeting?.title ?? "Meeting not found" };
}

export default async function MeetingPage({
  params,
}: PageProps<"/meetings/[id]">) {
  const { id } = await params;
  const meeting = await loadMeeting(id);
  if (!meeting) notFound();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-10 sm:px-8">
      <StatusPoller meetingId={meeting.id} status={meeting.status} />
      <BackToMeetingsLink />

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {meeting.title}
          </h1>
          <MeetingMeta
            meeting={meeting}
            speakerCount={meeting.speakers.length}
            className="text-muted-foreground mt-1 text-sm"
          />
        </div>
        <StatusBadge status={meeting.status} />
      </header>

      <section aria-label="Progress" className="mt-8 rounded-xl border p-5">
        <StatusStepper
          status={meeting.status}
          failedStep={meeting.failedStep}
        />
      </section>

      {meeting.status === "recording" && (
        <RecordingPanel
          meetingId={meeting.id}
          startedAt={meeting.recordingStartedAt}
        />
      )}

      <section className="mt-8 grid gap-8 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-medium">Speakers</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {meeting.speakers.map((speaker) => (
              <li
                key={speaker.id}
                className="bg-muted flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm"
              >
                <SpeakerNumber position={speaker.position} className="size-6" />
                {speaker.name}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-medium">Agenda</h2>
          {meeting.agenda ? (
            <p className="mt-3 text-sm leading-6 whitespace-pre-line">
              {meeting.agenda}
            </p>
          ) : (
            <p className="text-muted-foreground mt-3 text-sm">
              No agenda was given.
            </p>
          )}
        </div>
      </section>

      {meeting.status !== "recording" && (
        <Tabs defaultValue="transcript" className="mt-10">
          <TabsList variant="line" aria-label="Meeting content">
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
          </TabsList>
          <TabsContent value="transcript" className="mt-4">
            <TranscriptPanel meeting={meeting} />
          </TabsContent>
        </Tabs>
      )}
    </main>
  );
}

function TranscriptPanel({ meeting }: { meeting: Meeting }) {
  if (meeting.transcript) {
    return (
      <TranscriptView
        utterances={meeting.transcript.utterances}
        speakers={meeting.speakers}
      />
    );
  }

  if (meeting.status === "failed") {
    return (
      <div
        role="alert"
        className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
      >
        <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="font-medium">
            {MEETING_STATUS_LABELS[meeting.failedStep ?? "transcribing"]} failed
          </p>
          {meeting.errorMessage && (
            <p className="mt-1 leading-6">{meeting.errorMessage}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="text-muted-foreground flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center text-sm"
    >
      <Loader2 aria-hidden="true" className="size-5 animate-spin" />
      <p>
        <span className="text-foreground font-medium">Transcribing…</span>{" "}
        Utterances appear here as soon as the Transcript is ready. This page
        updates itself.
      </p>
    </div>
  );
}
