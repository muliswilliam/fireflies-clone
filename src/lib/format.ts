const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** "8 Sept 2026, 12:40" in the server's time zone. */
export function formatDateTime(date: Date): string {
  return dateTimeFormat.format(date);
}

/** Recording duration for humans: "45 s", "32 min", "1 h 05 min". */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} h ${String(minutes).padStart(2, "0")} min`;
}

/** Duration of a Recording, or null while it is still running. */
export function recordingDurationMs(recording: {
  recordingStartedAt: Date;
  recordingEndedAt: Date | null;
}): number | null {
  if (!recording.recordingEndedAt) return null;
  return (
    recording.recordingEndedAt.getTime() -
    recording.recordingStartedAt.getTime()
  );
}

export function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}
