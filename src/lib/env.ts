import { z } from "zod";

export const AI_PROVIDERS = ["claude", "fake"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

const serverEnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  /** Which implementation generates Transcripts (ADR-0001). Tests and e2e always use `fake`. */
  AI_PROVIDER: z.enum(AI_PROVIDERS).default("claude"),
  /** Global cap on non-sample Meetings created in any rolling 24 hours (ADR-0005). */
  MAX_MEETINGS_PER_DAY: z.coerce.number().int().positive().default(50),
  /** Test only: lets a Meeting title ask a provider to fail once (`src/lib/ai/fault-injection.ts`). */
  E2E_FAULT_INJECTION: z.stringbool().default(false),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

/** Parses and caches server environment. Throws with a readable message when a required variable is missing. */
export function getEnv(): ServerEnv {
  cached ??= serverEnvSchema.parse(process.env);
  return cached;
}
