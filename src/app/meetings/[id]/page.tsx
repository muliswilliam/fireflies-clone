import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { BackToMeetingsLink } from "@/components/back-to-meetings-link";
import { MeetingMeta } from "@/components/meetings/meeting-meta";
import {
  FailedPanel,
  ProcessingPanel,
} from "@/components/meetings/panel-states";
import { SpeakerNumber } from "@/components/meetings/speaker-number";
import { StatusBadge } from "@/components/meetings/status-badge";
import { StatusPoller } from "@/components/meetings/status-poller";
import { StatusStepper } from "@/components/meetings/status-stepper";
import { SummaryView } from "@/components/meetings/summary-view";
import { TranscriptView } from "@/components/meetings/transcript-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMeetingService, type Meeting } from "@/lib/meetings";

import { ActionItemsList } from "./action-items-list";
import { FailedBanner } from "./failed-banner";
import { RecordingPanel } from "./recording-panel";
import { RegenerateSummaryButton } from "./regenerate-summary-button";

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

      {meeting.status === "failed" && (
        <FailedBanner
          meetingId={meeting.id}
          failedStep={meeting.failedStep}
          errorMessage={meeting.errorMessage}
        />
      )}

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
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="action-items">
              Action Items
              {meeting.status === "ready" && (
                <span className="text-muted-foreground tabular-nums">
                  {meeting.actionItems.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="transcript" className="mt-4">
            <TranscriptPanel meeting={meeting} />
          </TabsContent>
          <TabsContent value="summary" className="mt-4">
            <SummaryPanel meeting={meeting} />
          </TabsContent>
          <TabsContent value="action-items" className="mt-4">
            <ActionItemsPanel meeting={meeting} />
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
      <FailedPanel document="Transcript" failedStep={meeting.failedStep} />
    );
  }
  return (
    <ProcessingPanel step="transcribing">
      Utterances appear here as soon as the Transcript is ready.
    </ProcessingPanel>
  );
}

function SummaryPanel({ meeting }: { meeting: Meeting }) {
  if (meeting.status === "ready" && meeting.summary) {
    return (
      <SummaryView
        summary={meeting.summary}
        actions={<RegenerateSummaryButton meetingId={meeting.id} />}
      />
    );
  }
  if (meeting.status === "failed") {
    return <FailedPanel document="Summary" failedStep={meeting.failedStep} />;
  }
  return <SummaryProcessing meeting={meeting} />;
}

function ActionItemsPanel({ meeting }: { meeting: Meeting }) {
  if (meeting.status === "ready") {
    return (
      <ActionItemsList
        meetingId={meeting.id}
        actionItems={meeting.actionItems}
        speakers={meeting.speakers}
      />
    );
  }
  if (meeting.status === "failed") {
    return (
      <FailedPanel document="Action Items" failedStep={meeting.failedStep} />
    );
  }
  return <SummaryProcessing meeting={meeting} />;
}

/** Summary and Action Items arrive together, so both tabs wait on the same steps. */
function SummaryProcessing({ meeting }: { meeting: Meeting }) {
  if (meeting.status === "summarizing") {
    return (
      <ProcessingPanel step="summarizing">
        The Overview, Key Takeaways and Action Items appear here once the
        Summary is ready.
      </ProcessingPanel>
    );
  }
  return (
    <ProcessingPanel step="transcribing">
      The Summary follows once the Transcript is ready.
    </ProcessingPanel>
  );
}
