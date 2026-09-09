import {
  formatDateTime,
  formatDuration,
  pluralize,
  recordingDurationMs,
} from "@/lib/format";

/**
 * The one-line summary under a Meeting title: when it started, how long it ran, who was there.
 * On a narrow screen it may wrap, but only between segments, never inside one.
 */
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
      <time
        dateTime={meeting.recordingStartedAt.toISOString()}
        className="whitespace-nowrap"
      >
        {formatDateTime(meeting.recordingStartedAt)}
      </time>
      {durationMs !== null && (
        <>
          {" · "}
          <span className="whitespace-nowrap">
            {formatDuration(durationMs)}
          </span>
        </>
      )}
      {" · "}
      <span className="whitespace-nowrap">
        {pluralize(speakerCount, "Speaker", "Speakers")}
      </span>
    </p>
  );
}
