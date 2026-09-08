import { cn } from "@/lib/utils";

import { speakerColor } from "./speaker-color";

/** The small numbered disc that identifies a Speaker by position, in the Speaker's colour. */
export function SpeakerNumber({
  position,
  className,
}: {
  position: number;
  className?: string;
}) {
  const color = speakerColor(position);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        color.chip,
        color.text,
        className,
      )}
    >
      {position + 1}
    </span>
  );
}
