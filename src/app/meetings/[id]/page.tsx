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
import type { FailedStep } from "@/lib/db/schema";
import {
  getMeetingService,
  hasSettledSummary,
  MeetingNotFoundError,
  type Meeting,
  type SummaryExport,
} from "@/lib/meetings";

import { ActionItemsList } from "./action-items-list";
import { DeleteMeetingButton } from "./delete-meeting-button";
import { ExportSummaryMenu } from "./export-summary-menu";
import { FailedBanner } from "./failed-banner";
import { MeetingTitle } from "./meeting-title";
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
  const summaryExport = await loadSummaryExport(meeting);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-10 sm:px-8">
      <StatusPoller meetingId={meeting.id} status={meeting.status} />
      <BackToMeetingsLink />

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-72">
          <MeetingTitle meetingId={meeting.id} title={meeting.title} />
          <MeetingMeta
            meeting={meeting}
            speakerCount={meeting.speakers.length}
            className="text-muted-foreground mt-1 text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={meeting.status} className="mr-2" />
          <ExportSummaryMenu summaryExport={summaryExport} />
          <DeleteMeetingButton meetingId={meeting.id} title={meeting.title} />
        </div>
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
          failedStep={failedStepOf(meeting)}
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
      <FailedPanel document="Transcript" failedStep={failedStepOf(meeting)} />
    );
  }
  return (
    <ProcessingPanel step="transcribing">
      Utterances appear here as soon as the Transcript is ready.
    </ProcessingPanel>
  );
}

function SummaryPanel({ meeting }: { meeting: Meeting }) {
  // A failed regenerate keeps the previous Summary; show it rather than an empty tab.
  if (hasSettledSummary(meeting)) {
    return (
      <SummaryView
        summary={meeting.summary}
        actions={
          meeting.status === "ready" && (
            <RegenerateSummaryButton meetingId={meeting.id} />
          )
        }
      />
    );
  }
  if (meeting.status === "failed") {
    return (
      <FailedPanel document="Summary" failedStep={failedStepOf(meeting)} />
    );
  }
  return <SummaryProcessing meeting={meeting} />;
}

function ActionItemsPanel({ meeting }: { meeting: Meeting }) {
  if (hasSettledSummary(meeting)) {
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
      <FailedPanel document="Action Items" failedStep={failedStepOf(meeting)} />
    );
  }
  return <SummaryProcessing meeting={meeting} />;
}

/** The Export menu's payload: the Markdown once the Summary is settled, `null` until then. */
async function loadSummaryExport(
  meeting: Meeting,
): Promise<SummaryExport | null> {
  if (!hasSettledSummary(meeting)) return null;
  try {
    return await getMeetingService().exportSummaryMarkdown(meeting.id);
  } catch (error) {
    // Deleted between the two reads: the page is gone, not broken.
    if (error instanceof MeetingNotFoundError) notFound();
    throw error;
  }
}

/** The schema guarantees `failed_step` is set whenever the Status is failed; this narrows the type once. */
function failedStepOf(meeting: Meeting): FailedStep {
  return meeting.failedStep ?? "transcribing";
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
