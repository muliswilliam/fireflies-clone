import type {
  ActionItemDraft,
  SummarizationOutput,
} from "@/lib/meetings/summary";

import { topicsFrom } from "./fake-transcription-provider";
import { hashString, pick, seededRandom } from "./seeded-random";
import type {
  SummarizationInput,
  SummarizationProvider,
} from "./summarization-provider";

/**
 * A SummarizationProvider that costs nothing and always gives the same answer for the same input.
 * Used by every automated test and by `AI_PROVIDER=fake`. It writes a plausible digest from the
 * title and agenda; it does not read the Transcript beyond who spoke.
 */
export function createFakeSummarizationProvider(): SummarizationProvider {
  return {
    async summarize(input) {
      return generateFakeSummary(input);
    },
  };
}

export function generateFakeSummary(
  input: SummarizationInput,
): SummarizationOutput {
  const random = seededRandom(
    hashString(
      JSON.stringify([
        input.title,
        input.agenda,
        input.speakers.map((speaker) => speaker.id),
        input.transcript.utterances.length,
      ]),
    ),
  );
  const { subject, points } = topicsFrom(input);
  const names = input.speakers.map((speaker) => speaker.name);

  const overview = pick(random, OVERVIEWS)
    .replaceAll("{subject}", subject)
    .replaceAll("{count}", String(input.speakers.length))
    .replaceAll("{names}", listNames(names))
    .replaceAll("{first}", quote(points[0]));

  // 3 to 5 Key Takeaways, walking the agenda so every point gets a mention when it can.
  const takeawayCount = 3 + Math.floor(random() * 3);
  const keyTakeaways = Array.from({ length: takeawayCount }, (_, index) =>
    TAKEAWAYS[index % TAKEAWAYS.length]
      .replaceAll("{point}", quote(points[index % points.length]))
      .replaceAll("{name}", names[index % names.length]),
  );

  // 2 to 4 Action Items; owners rotate through the Speakers and one is left unowned.
  const itemCount = 2 + Math.floor(random() * 3);
  const actionItems: ActionItemDraft[] = Array.from(
    { length: itemCount },
    (_, index) => ({
      text: ACTION_ITEMS[index % ACTION_ITEMS.length].replaceAll(
        "{point}",
        quote(points[(index + 1) % points.length]),
      ),
      ownerSpeakerId:
        index === itemCount - 1
          ? null
          : input.speakers[index % input.speakers.length].id,
      dueDate: pick(random, DUE_DATES),
    }),
  );

  return { overview, keyTakeaways, actionItems };
}

const OVERVIEWS = [
  "{names} met to work through {subject}. They started with {first}, agreed on an approach, and closed with owners for the follow-ups.",
  "A {count}-person session on {subject}. The group focused on {first} and left with clear next steps.",
  "This Meeting covered {subject}. {names} weighed the options, settled the open questions, and assigned the remaining work.",
];

const TAKEAWAYS = [
  "The group agreed to decide on {point} now rather than defer it again.",
  "{name} raised concerns about {point}; the smaller, safer option was preferred.",
  "Work behind {point} is roughly two thirds complete.",
  "The dependency on the platform team is the main risk for {point}.",
  "{point} will be revisited once the numbers are in.",
];

const ACTION_ITEMS = [
  "Draft a short proposal for {point}",
  "Confirm the numbers behind {point} and share them with the group",
  "Follow up with the platform team about {point}",
  "Schedule a check-in on progress against {point}",
];

const DUE_DATES = [
  "Friday",
  "Tomorrow",
  "Next Tuesday",
  "End of the month",
  null,
];

function quote(point: string): string {
  return `“${point}”`;
}

/** "Amara, Ben and Chloe". */
function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "The team";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
