import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

/** Parses and caches server environment. Throws with a readable message when a required variable is missing. */
export function getEnv(): ServerEnv {
  cached ??= serverEnvSchema.parse(process.env);
  return cached;
}
