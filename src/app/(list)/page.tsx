import { Mic, Plus, Search } from "lucide-react";
import Link from "next/link";

import { LinkPendingSpinner } from "@/components/link-pending-spinner";
import { MeetingMeta } from "@/components/meetings/meeting-meta";
import { SampleBadge } from "@/components/meetings/sample-badge";
import { StatusBadge } from "@/components/meetings/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getEnv } from "@/lib/env";
import { throwIfPageFaultRequested } from "@/lib/fault-injection";
import { getMeetingService, type MeetingListItem } from "@/lib/meetings";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { q } = await searchParams;
  const search = typeof q === "string" ? q : "";
  if (getEnv().E2E_FAULT_INJECTION) throwIfPageFaultRequested(search);
  const list = await getMeetingService().listMeetings({ search });

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-10 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Meetings</h1>
        <Link href="/meetings/new" className={buttonVariants({ size: "lg" })}>
          <Plus data-icon="inline-start" aria-hidden="true" />
          New meeting
        </Link>
      </header>

      <form role="search" action="/" method="get" className="relative mt-6">
        <Search
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search meetings by title"
          aria-label="Search meetings"
          className="h-10 pl-9"
        />
      </form>

      {list.length === 0 ? (
        search.trim() ? (
          <NoMatches search={search} />
        ) : (
          <EmptyState />
        )
      ) : (
        <ul aria-label="Meetings" className="mt-6 divide-y rounded-xl border">
          {list.map((meeting) => (
            <MeetingRow key={meeting.id} meeting={meeting} />
          ))}
        </ul>
      )}
    </main>
  );
}

function MeetingRow({ meeting }: { meeting: MeetingListItem }) {
  return (
    <li>
      <Link
        href={`/meetings/${meeting.id}`}
        className="hover:bg-muted/50 focus-visible:ring-ring/50 flex items-center justify-between gap-4 px-5 py-4 outline-none first:rounded-t-xl last:rounded-b-xl focus-visible:ring-3"
      >
        <div className="min-w-0">
          {/* Wraps so a long title keeps its width on a phone and the Sample badge drops below it. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="min-w-0 truncate font-medium">{meeting.title}</p>
            {meeting.isSample && <SampleBadge />}
          </div>
          <MeetingMeta
            meeting={meeting}
            speakerCount={meeting.speakerCount}
            className="text-muted-foreground mt-1 text-sm"
          />
        </div>
        <span className="flex shrink-0 items-center gap-3">
          <LinkPendingSpinner />
          <StatusBadge status={meeting.status} />
        </span>
      </Link>
    </li>
  );
}

function EmptyState() {
  return (
    <section
      aria-labelledby="empty-state-title"
      className="mt-6 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed px-6 py-20 text-center"
    >
      <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <Mic aria-hidden="true" className="size-5" />
      </span>
      <h2 id="empty-state-title" className="mt-5 text-lg font-medium">
        No meetings yet
      </h2>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-6">
        Meetings you record will appear here with their transcript, summary and
        action items.
      </p>
      <Link
        href="/meetings/new"
        className={buttonVariants({ variant: "outline", className: "mt-6" })}
      >
        <Plus data-icon="inline-start" aria-hidden="true" />
        New meeting
      </Link>
    </section>
  );
}

function NoMatches({ search }: { search: string }) {
  return (
    <section
      aria-labelledby="no-matches-title"
      className="mt-6 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed px-6 py-20 text-center"
    >
      <h2 id="no-matches-title" className="text-lg font-medium">
        No meetings match &ldquo;{search.trim()}&rdquo;
      </h2>
      <p className="text-muted-foreground mt-2 text-sm">
        Try a different title, or{" "}
        <Link href="/" className="underline underline-offset-4">
          clear the search
        </Link>
        .
      </p>
    </section>
  );
}
