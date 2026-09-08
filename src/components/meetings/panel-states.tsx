import { AlertCircle, Loader2 } from "lucide-react";

import type { FailedStep } from "@/lib/db/schema";

import { MEETING_STATUS_LABELS } from "./status-badge";

/** Placeholder for a tab whose content is still being produced. The page polls and refreshes itself. */
export function ProcessingPanel({
  step,
  children,
}: {
  /** The step currently running, shown as "Transcribing…" or "Summarizing…". */
  step: FailedStep;
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className="text-muted-foreground flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center text-sm"
    >
      <Loader2 aria-hidden="true" className="size-5 animate-spin" />
      <p>
        <span className="text-foreground font-medium">
          {MEETING_STATUS_LABELS[step]}…
        </span>{" "}
        {children} This page updates itself.
      </p>
    </div>
  );
}

/** What went wrong, for a tab whose content never arrived because processing failed. */
export function FailedPanel({
  failedStep,
  errorMessage,
}: {
  failedStep: FailedStep | null;
  errorMessage: string | null;
}) {
  return (
    <div
      role="alert"
      className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-medium">
          {MEETING_STATUS_LABELS[failedStep ?? "transcribing"]} failed
        </p>
        {errorMessage && <p className="mt-1 leading-6">{errorMessage}</p>}
      </div>
    </div>
  );
}
