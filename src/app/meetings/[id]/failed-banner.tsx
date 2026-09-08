"use client";

import { AlertCircle, RotateCcw } from "lucide-react";
import { useTransition } from "react";

import { MEETING_STATUS_LABELS } from "@/components/meetings/status-badge";
import { Button } from "@/components/ui/button";
import type { FailedStep } from "@/lib/db/schema";

import { retryMeetingAction } from "./actions";

/** Which step failed and why, with Retry. Retry resumes at that step (ADR-0002). */
export function FailedBanner({
  meetingId,
  failedStep,
  errorMessage,
}: {
  meetingId: string;
  failedStep: FailedStep | null;
  errorMessage: string | null;
}) {
  const [pending, startTransition] = useTransition();
  // The schema guarantees failed_step is set whenever status is failed.
  const step = failedStep ?? "transcribing";

  function retry() {
    startTransition(async () => {
      // The action re-renders the page with the Meeting back in flight; polling takes over.
      await retryMeetingAction(meetingId);
    });
  }

  return (
    <section
      role="alert"
      aria-label="Processing failed"
      className="border-destructive/30 bg-destructive/5 mt-4 flex flex-wrap items-start justify-between gap-4 rounded-xl border px-5 py-4"
    >
      <div className="flex min-w-0 items-start gap-3 text-sm">
        <AlertCircle
          aria-hidden="true"
          className="text-destructive mt-0.5 size-4 shrink-0"
        />
        <div className="min-w-0">
          <p className="text-destructive font-medium">
            {MEETING_STATUS_LABELS[step]} failed
          </p>
          <p className="text-muted-foreground mt-1 leading-6 break-words">
            {errorMessage ?? "Processing stopped without saying why."}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {step === "summarizing"
              ? "Retry keeps the Transcript and only summarizes again."
              : "Retry transcribes the Recording again, then summarizes."}
          </p>
        </div>
      </div>
      <Button type="button" size="sm" onClick={retry} disabled={pending}>
        <RotateCcw data-icon="inline-start" aria-hidden="true" />
        {pending ? "Retrying…" : "Retry"}
      </Button>
    </section>
  );
}
