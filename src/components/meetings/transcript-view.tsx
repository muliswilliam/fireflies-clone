"use client";

import { useState } from "react";

import { formatTimestamp } from "@/lib/format";
import type { Speaker, Utterance } from "@/lib/meetings";
import { cn } from "@/lib/utils";

import { speakerColor } from "./speaker-color";

/** The Transcript as a list of Utterances; click a timestamp to highlight that moment. */
export function TranscriptView({
  utterances,
  speakers,
}: {
  utterances: Utterance[];
  speakers: Speaker[];
}) {
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const speakersById = new Map(
    speakers.map((speaker) => [speaker.id, speaker]),
  );

  return (
    <ol aria-label="Transcript" className="divide-y rounded-xl border">
      {utterances.map((utterance, index) => {
        const speaker = speakersById.get(utterance.speakerId);
        const color = speakerColor(speaker?.position ?? 0);
        const isHighlighted = highlighted === index;
        const timestamp = formatTimestamp(utterance.startMs);
        return (
          <li
            key={index}
            data-highlighted={isHighlighted ? "true" : undefined}
            className={cn(
              "grid grid-cols-[3.5rem_1fr] gap-x-4 px-4 py-3 transition-colors first:rounded-t-xl last:rounded-b-xl sm:grid-cols-[3.5rem_10rem_1fr]",
              isHighlighted && "bg-muted",
            )}
          >
            <button
              type="button"
              aria-label={`Highlight Utterance at ${timestamp}`}
              aria-pressed={isHighlighted}
              onClick={() => setHighlighted(isHighlighted ? null : index)}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 h-fit w-fit rounded font-mono text-xs leading-6 tabular-nums outline-none focus-visible:ring-3"
            >
              {timestamp}
            </button>
            <p
              className={cn(
                "truncate text-sm leading-6 font-medium",
                color.text,
              )}
            >
              {speaker?.name ?? "Unknown Speaker"}
            </p>
            <p className="col-span-2 mt-1 text-sm leading-6 sm:col-span-1 sm:mt-0">
              {utterance.text}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
