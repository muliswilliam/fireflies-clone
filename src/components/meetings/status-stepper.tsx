import { Check, X } from "lucide-react";

import type { FailedStep, MeetingStatus } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

import { MEETING_STATUS_LABELS } from "./status-badge";

const STEPS = ["recording", "transcribing", "summarizing", "ready"] as const;
type Step = (typeof STEPS)[number];

type StepProgress = "complete" | "current" | "failed" | "upcoming";

const STEP_STYLES: Record<
  StepProgress,
  { marker: string; label: string; connector: string }
> = {
  complete: {
    marker: "border-primary bg-primary text-primary-foreground",
    label: "",
    connector: "bg-primary",
  },
  current: {
    marker: "border-primary text-primary ring-4 ring-primary/15",
    label: "",
    connector: "bg-border",
  },
  failed: {
    marker: "border-destructive bg-destructive/10 text-destructive",
    label: "text-destructive",
    connector: "bg-border",
  },
  upcoming: {
    marker: "text-muted-foreground",
    label: "text-muted-foreground",
    connector: "bg-border",
  },
};

function stepProgress(
  status: MeetingStatus,
  failedStep: FailedStep | null,
): Record<Step, StepProgress> {
  // The schema guarantees failed_step is set whenever status is failed.
  const activeStep: Step =
    status === "failed" ? (failedStep ?? "transcribing") : status;
  const activeIndex = STEPS.indexOf(activeStep);

  return Object.fromEntries(
    STEPS.map((step, index) => {
      if (index < activeIndex) return [step, "complete"];
      if (index > activeIndex) return [step, "upcoming"];
      if (status === "failed") return [step, "failed"];
      // Ready is the terminal step: reaching it means it is done, not in progress.
      return [step, status === "ready" ? "complete" : "current"];
    }),
  ) as Record<Step, StepProgress>;
}

/** Where a Meeting is in its lifecycle, as a horizontal stepper. */
export function StatusStepper({
  status,
  failedStep,
}: {
  status: MeetingStatus;
  failedStep: FailedStep | null;
}) {
  const progress = stepProgress(status, failedStep);

  return (
    <ol
      aria-label="Meeting Status"
      data-status={status}
      className="flex items-start gap-2 sm:gap-4"
    >
      {STEPS.map((step, index) => {
        const state = progress[step];
        const styles = STEP_STYLES[state];
        return (
          <li
            key={step}
            data-step={step}
            data-step-progress={state}
            aria-current={
              state === "current" || state === "failed" ? "step" : undefined
            }
            className="flex flex-1 items-center gap-2 sm:gap-3"
          >
            <div className="flex min-w-0 flex-col items-center gap-2 text-center sm:flex-row sm:text-left">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  styles.marker,
                )}
              >
                <StepMarkerContent state={state} index={index} />
              </span>
              <span
                className={cn("text-xs font-medium sm:text-sm", styles.label)}
              >
                {MEETING_STATUS_LABELS[step]}
                {state === "failed" && (
                  <span className="sr-only">, failed</span>
                )}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className={cn("mb-6 h-px flex-1 sm:mb-0", styles.connector)}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StepMarkerContent({
  state,
  index,
}: {
  state: StepProgress;
  index: number;
}) {
  if (state === "complete")
    return <Check aria-hidden="true" className="size-3.5" />;
  if (state === "failed") return <X aria-hidden="true" className="size-3.5" />;
  return <>{index + 1}</>;
}
