import type { z } from "zod";

/** The two documents a provider produces for a Meeting; used to word validation failures. */
export type ProviderDocument = "Transcript" | "Summary";

/** The first thing wrong with a rejected provider answer, with where it sits: "Utterance runs past the end of the Recording at utterances.3.endMs". */
export function describeFirstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "unknown issue";
  const where = issue.path.length > 0 ? ` at ${issue.path.join(".")}` : "";
  return `${issue.message}${where}`;
}
