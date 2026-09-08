import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { BackToMeetingsLink } from "@/components/back-to-meetings-link";
import { MeetingMeta } from "@/components/meetings/meeting-meta";
import { SpeakerNumber } from "@/components/meetings/speaker-number";
import { StatusBadge } from "@/components/meetings/status-badge";
import { StatusStepper } from "@/components/meetings/status-stepper";
import { getMeetingService } from "@/lib/meetings";

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

      <section className="mt-8 grid gap-8 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-medium">Speakers</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {meeting.speakers.map((speaker) => (
              <li
                key={speaker.id}
                className="bg-muted flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm"
              >
                <SpeakerNumber
                  position={speaker.position}
                  className="bg-background size-6"
                />
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
    </main>
  );
}
