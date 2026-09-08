import { AlertCircle, Loader2 } from "lucide-react";

import type { FailedStep, ProcessingStep } from "@/lib/db/schema";

import { MEETING_STATUS_LABELS } from "./status-badge";

/** Placeholder for a tab whose content is still being produced. The page polls and refreshes itself. */
export function ProcessingPanel({
  step,
  children,
}: {
  /** The step currently running, shown as "Transcribing…" or "Summarizing…". */
  step: ProcessingStep;
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

/**
 * Placeholder for a tab whose content never arrived because processing failed. The banner
 * above the tabs carries the error and the Retry button, so this only says what is missing.
 */
export function FailedPanel({
  document,
  failedStep,
}: {
  document: "Transcript" | "Summary" | "Action Items";
  failedStep: FailedStep | null;
}) {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center text-sm">
      <AlertCircle aria-hidden="true" className="text-destructive size-5" />
      <p>
        <span className="text-foreground font-medium">No {document} yet.</span>{" "}
        {MEETING_STATUS_LABELS[failedStep ?? "transcribing"]} failed; use Retry
        above to pick up where processing stopped.
      </p>
    </div>
  );
}
