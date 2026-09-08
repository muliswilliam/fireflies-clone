import type { Transcript, Utterance } from "@/lib/meetings/transcript";

import type {
  TranscriptionInput,
  TranscriptionProvider,
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
  const random = seededRandom(
    hashString(
      JSON.stringify([
        input.title,
        input.agenda,
        input.speakers.map((speaker) => speaker.id),
        input.durationMs,
        input.targetUtteranceCount,
      ]),
    ),
  );
  const count = input.targetUtteranceCount;
  const slotMs = input.durationMs / count;
  const topics = topicsFrom(input);

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
      text: sentenceFor(random, index, count, topics, input, speakerIndex),
    });
  }

  return { utterances };
}

type Topics = { subject: string; points: string[] };

function topicsFrom(input: TranscriptionInput): Topics {
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
  "Good session. I'll send the notes around this afternoon.",
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

function sentenceFor(
  random: () => number,
  index: number,
  count: number,
  topics: Topics,
  input: TranscriptionInput,
  speakerIndex: number,
): string {
  const template = pick(
    random,
    index === 0 ? OPENERS : index === count - 1 ? CLOSERS : TEMPLATES,
  );
  return fill(template, topics, input, speakerIndex, index);
}

function fill(
  template: string,
  topics: Topics,
  input: TranscriptionInput,
  speakerIndex: number,
  index: number,
): string {
  // Name another Speaker, never the one talking.
  const others = input.speakers.filter((_, index) => index !== speakerIndex);
  const named = others[speakerIndex % others.length] ?? input.speakers[0];
  // Agenda items are quoted so a verb phrase like "pick a launch date" still reads naturally.
  const point = topics.points[(index + speakerIndex) % topics.points.length];
  return template
    .replaceAll("{subject}", topics.subject)
    .replaceAll("{point}", `\u201c${point}\u201d`)
    .replaceAll("{name}", named.name);
}

function pick<T>(random: () => number, list: readonly T[]): T {
  return list[Math.floor(random() * list.length)];
}

function pickDifferent(random: () => number, size: number, previous: number) {
  if (size < 2) return 0;
  const offset = 1 + Math.floor(random() * (size - 1));
  return (previous + offset) % size;
}

/** FNV-1a: small, stable, good enough to seed a PRNG. */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: a tiny seeded PRNG returning numbers in [0, 1). */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
