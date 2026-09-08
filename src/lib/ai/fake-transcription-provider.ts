import type { Transcript, Utterance } from "@/lib/meetings/transcript";

import { hashString, pick, seededRandom } from "./seeded-random";
import type {
  TranscriptionInput,
  TranscriptionProvider,
  TranscriptionSpeaker,
} from "./transcription-provider";

/**
 * A TranscriptionProvider that costs nothing and always gives the same answer for the same input.
 * Used by every automated test and by `AI_PROVIDER=fake`. The dialogue is plausible filler
 * about the Meeting's title and agenda, not a real conversation.
 */
export function createFakeTranscriptionProvider(): TranscriptionProvider {
  return {
    async generateTranscript(input) {
      return generateFakeTranscript(input);
    },
  };
}

export function generateFakeTranscript(input: TranscriptionInput): Transcript {
  const dialogue: Dialogue = {
    random: seededRandom(
      hashString(
        JSON.stringify([
          input.title,
          input.agenda,
          input.speakers.map((speaker) => speaker.id),
          input.durationMs,
          input.targetUtteranceCount,
        ]),
      ),
    ),
    topics: topicsFrom(input),
    speakers: input.speakers,
  };
  const { random } = dialogue;
  const count = input.targetUtteranceCount;
  const slotMs = input.durationMs / count;

  const utterances: Utterance[] = [];
  let previousSpeaker = -1;
  for (let index = 0; index < count; index++) {
    // Each Utterance lives in its own slot so timestamps never overlap or run backwards.
    const slotStart = slotMs * index;
    const slotEnd = slotMs * (index + 1);
    const startMs = Math.floor(slotStart + random() * slotMs * 0.15);
    const endMs = Math.floor(
      Math.min(slotEnd, startMs + slotMs * (0.5 + random() * 0.45)),
    );

    // Every Speaker gets the floor early on; after that, avoid back-to-back turns.
    const speakerIndex =
      index < input.speakers.length
        ? index
        : pickDifferent(random, input.speakers.length, previousSpeaker);
    previousSpeaker = speakerIndex;

    utterances.push({
      speakerId: input.speakers[speakerIndex].id,
      startMs,
      endMs: Math.max(startMs, endMs),
      text: sentenceFor(dialogue, { index, count, speakerIndex }),
    });
  }

  return { utterances };
}

export type Topics = { subject: string; points: string[] };

/** Everything the sentence generator needs about the Meeting, fixed for one Transcript. */
type Dialogue = {
  random: () => number;
  topics: Topics;
  speakers: TranscriptionSpeaker[];
};

/** Where in the Transcript a sentence sits and who is saying it. */
type Turn = { index: number; count: number; speakerIndex: number };

/** What the Meeting is about, read from the title and agenda. Shared by both fakes so they agree. */
export function topicsFrom(input: {
  title: string;
  agenda: string | null;
}): Topics {
  const points = (input.agenda ?? "")
    .split(/[.,;\n]+/)
    .map((point) => point.trim().replace(/^(and|then|also)\s+/i, ""))
    .filter((point) => point.length > 0);
  return {
    subject: input.title.trim() || "the meeting",
    points: points.length > 0 ? points : [`the plan for ${input.title.trim()}`],
  };
}

const OPENERS = [
  "Thanks for joining, everyone. Today we are here to talk about {subject}.",
  "Let's get started. The goal for this session is {subject}.",
  "Right, we have a lot to cover on {subject}, so let's dive in.",
];

const CLOSERS = [
  "Good meeting. I'll send the Summary around this afternoon.",
  "That's everything on my list. Thanks all, talk soon.",
  "Let's wrap there. Same time next week to check progress.",
];

const TEMPLATES = [
  "On {point}, I think we should decide today rather than push it again.",
  "Can we spend a minute on {point}? I have a couple of concerns.",
  "My view on {point} is that the smaller option is the safer bet.",
  "{name}, you were closest to {point}. Where did it land?",
  "I agree with {name}. We should keep {point} scoped tightly.",
  "Quick update: the work behind {point} is about two thirds done.",
  "If we take {point} first, the rest falls into place more easily.",
  "Let's put a name against {point} so it does not slip.",
  "I'd rather not commit to {point} without checking the numbers first.",
  "That works for me. I can own {point} and report back on Friday.",
  "One risk with {point} is the dependency on the platform team.",
  "Noted. Let's park {point} and revisit once we have the data.",
  "To summarise so far: we agreed the approach and {name} takes {point}.",
  "Does anyone object to moving ahead with {point} as discussed?",
  "Makes sense. I'll draft a short proposal for {point} by tomorrow.",
];

function sentenceFor(dialogue: Dialogue, turn: Turn): string {
  const { index, count, speakerIndex } = turn;
  const { topics, speakers } = dialogue;
  const template = pick(
    dialogue.random,
    index === 0 ? OPENERS : index === count - 1 ? CLOSERS : TEMPLATES,
  );
  // Name another Speaker, never the one talking.
  const others = speakers.filter((_, position) => position !== speakerIndex);
  const named = others[speakerIndex % others.length] ?? speakers[0];
  // Agenda items are quoted so a verb phrase like "pick a launch date" still reads naturally.
  const point = topics.points[(index + speakerIndex) % topics.points.length];
  return template
    .replaceAll("{subject}", topics.subject)
    .replaceAll("{point}", `\u201c${point}\u201d`)
    .replaceAll("{name}", named.name);
}

function pickDifferent(random: () => number, size: number, previous: number) {
  if (size < 2) return 0;
  const offset = 1 + Math.floor(random() * (size - 1));
  return (previous + offset) % size;
}
