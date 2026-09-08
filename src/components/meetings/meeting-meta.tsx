import {
  formatDateTime,
  formatDuration,
  pluralize,
  recordingDurationMs,
} from "@/lib/format";

/** The one-line summary under a Meeting title: when it started, how long it ran, who was there. */
export function MeetingMeta({
  meeting,
  speakerCount,
  className,
}: {
  meeting: { recordingStartedAt: Date; recordingEndedAt: Date | null };
  speakerCount: number;
  className?: string;
}) {
  const durationMs = recordingDurationMs(meeting);

  return (
    <p className={className}>
      <time dateTime={meeting.recordingStartedAt.toISOString()}>
        {formatDateTime(meeting.recordingStartedAt)}
      </time>
      {durationMs !== null && <> · {formatDuration(durationMs)}</>}
      {" · "}
      {pluralize(speakerCount, "Speaker", "Speakers")}
    </p>
  );
}
