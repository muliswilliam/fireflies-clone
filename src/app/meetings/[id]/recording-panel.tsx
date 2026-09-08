"use client";

import { Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { stopRecordingAction } from "./actions";
import { Button } from "@/components/ui/button";
import { formatTimestamp } from "@/lib/format";

/** The recording view: how long the Recording has run, a pulsing indicator, and Stop. */
export function RecordingPanel({
  meetingId,
  startedAt,
}: {
  meetingId: string;
  startedAt: Date;
}) {
  const elapsedMs = useElapsed(startedAt);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function stop() {
    startTransition(async () => {
      await stopRecordingAction(meetingId);
      // The Meeting is now transcribing; re-render the page from the server to show it.
      router.refresh();
    });
  }

  return (
    <section
      aria-label="Recording"
      className="mt-8 flex flex-col items-center gap-6 rounded-xl border px-6 py-10 text-center"
    >
      <div className="flex items-center gap-3">
        <span
          data-testid="recording-indicator"
          aria-hidden="true"
          className="relative flex size-3"
        >
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex size-3 rounded-full bg-red-500" />
        </span>
        <span className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
          Recording
        </span>
      </div>
      <p
        role="timer"
        aria-label="Recording time"
        aria-live="off"
        suppressHydrationWarning
        className="font-mono text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl"
      >
        {formatTimestamp(elapsedMs)}
      </p>
      <Button
        type="button"
        size="lg"
        variant="destructive"
        onClick={stop}
        disabled={pending}
      >
        <Square
          data-icon="inline-start"
          aria-hidden="true"
          className="fill-current"
        />
        {pending ? "Stopping…" : "Stop recording"}
      </Button>
      <p className="text-muted-foreground max-w-sm text-sm leading-6">
        Stop whenever you like. The Transcript length follows the Recording
        length.
      </p>
    </section>
  );
}

/** Milliseconds since `startedAt`, ticking a few times a second so the seconds never look stuck. */
function useElapsed(startedAt: Date): number {
  const [elapsed, setElapsed] = useState(
    () => Date.now() - startedAt.getTime(),
  );

  useEffect(() => {
    const tick = () => setElapsed(Date.now() - startedAt.getTime());
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [startedAt]);

  return elapsed;
}
