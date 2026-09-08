import { cn } from "@/lib/utils";

/** The small numbered disc that identifies a Speaker by position. */
export function SpeakerNumber({
  position,
  className,
}: {
  position: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium",
        className,
      )}
    >
      {position + 1}
    </span>
  );
}
