/**
 * Fixed palette keyed by Speaker position, so a Speaker keeps one colour everywhere
 * (form, chips, Transcript). Six entries: a Meeting has at most six Speakers.
 */
export const SPEAKER_PALETTE = [
  { text: "text-sky-700 dark:text-sky-300", chip: "bg-sky-500/15" },
  { text: "text-emerald-700 dark:text-emerald-300", chip: "bg-emerald-500/15" },
  { text: "text-amber-700 dark:text-amber-300", chip: "bg-amber-500/15" },
  { text: "text-violet-700 dark:text-violet-300", chip: "bg-violet-500/15" },
  { text: "text-rose-700 dark:text-rose-300", chip: "bg-rose-500/15" },
  { text: "text-teal-700 dark:text-teal-300", chip: "bg-teal-500/15" },
] as const;

export function speakerColor(position: number) {
  return SPEAKER_PALETTE[position % SPEAKER_PALETTE.length];
}
