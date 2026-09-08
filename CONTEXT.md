# Fireflies Clone

A simplified replica of Fireflies.ai: record a meeting, produce a transcript, and distill it into a summary with action items. Single shared workspace, no user accounts.

## Language

**Meeting**:
A single recorded conversation with a title and participants, moving through a lifecycle from recording to summarized.
_Avoid_: Call, session, note

**Recording**:
The act and time span of capturing a Meeting. Has a start, an end, and a duration.
_Avoid_: Capture, audio

**Transcript**:
The ordered text record of what was said in a Meeting, made of Utterances.
_Avoid_: Transcription (reserved for the process that produces a Transcript), notes

**Utterance**:
One speaker-attributed, time-stamped span of speech within a Transcript.
_Avoid_: Line, segment, message

**Speaker**:
A named participant in a Meeting to whom Utterances are attributed.
_Avoid_: User, attendee, participant

**Summary**:
The AI-generated digest of a Meeting, made of an Overview, Key Takeaways, and Action Items.
_Avoid_: Notes, recap

**Overview**:
The short prose paragraph at the top of a Summary describing what the Meeting was about.
_Avoid_: Abstract, description

**Key Takeaway**:
A single important point or decision from the Meeting.
_Avoid_: Highlight, insight

**Action Item**:
A concrete follow-up task from the Meeting, optionally with an owner and due date.
_Avoid_: Todo, task, next step

**Meeting Status**:
Where a Meeting is in its lifecycle: recording, transcribing, summarizing, ready, or failed. A failed Meeting can be retried from the step that failed.
_Avoid_: State, stage, phase

**Sample Meeting**:
A Meeting seeded with the application so the workspace is never empty. Marked as such; otherwise identical to any other Meeting.
_Avoid_: Demo meeting, fixture, example

**Instant Meeting**:
A Meeting created without a live Recording; its Recording duration is chosen up front and processing starts immediately.
_Avoid_: Quick meeting, simulated meeting, demo
