import { Badge } from "@/components/ui/badge";
import type { MeetingStatus } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  recording: "Recording",
  transcribing: "Transcribing",
  summarizing: "Summarizing",
  ready: "Ready",
  failed: "Failed",
};

const STATUS_BADGE_VARIANTS: Record<
  MeetingStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  recording: "outline",
  transcribing: "secondary",
  summarizing: "secondary",
  ready: "default",
  failed: "destructive",
};

export function StatusBadge({
  status,
  className,
}: {
  status: MeetingStatus;
  className?: string;
}) {
  return (
    <Badge
      variant={STATUS_BADGE_VARIANTS[status]}
      className={cn("gap-1.5", className)}
    >
      {status === "recording" && <RecordingDot />}
      {MEETING_STATUS_LABELS[status]}
    </Badge>
  );
}

/** The pulsing red dot that says "a Recording is in progress". */
export function RecordingDot({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("relative flex size-2", className)}>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75" />
      <span className="relative inline-flex size-2 rounded-full bg-red-500" />
    </span>
  );
}
