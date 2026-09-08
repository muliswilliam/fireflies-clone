import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  /** Global cap on non-sample Meetings created in any rolling 24 hours (ADR-0005). */
  MAX_MEETINGS_PER_DAY: z.coerce.number().int().positive().default(50),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

/** Parses and caches server environment. Throws with a readable message when a required variable is missing. */
export function getEnv(): ServerEnv {
  cached ??= serverEnvSchema.parse(process.env);
  return cached;
}
