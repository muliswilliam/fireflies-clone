import { z } from "zod";

export const AI_PROVIDERS = ["claude", "fake"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const DEFAULT_AI_MODEL = "claude-opus-5";

const serverEnvSchema = z
  .object({
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    /** Which implementation generates Transcripts and Summaries (ADR-0001). */
    AI_PROVIDER: z.enum(AI_PROVIDERS),
    /** Claude model id used by the `claude` provider. */
    AI_MODEL: z.string().trim().min(1).default(DEFAULT_AI_MODEL),
    /** Required by the `claude` provider; ignored by `fake`. */
    ANTHROPIC_API_KEY: z.string().optional(),
    /** Global cap on non-sample Meetings created in any rolling 24 hours (ADR-0005). */
    MAX_MEETINGS_PER_DAY: z.coerce.number().int().positive().default(50),
    /** Test only: lets a Meeting title ask a provider to fail once (`src/lib/fault-injection.ts`). */
    E2E_FAULT_INJECTION: z.stringbool().default(false),
  })
  .superRefine((env, ctx) => {
    if (env.AI_PROVIDER === "claude" && env.ANTHROPIC_API_KEY === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["ANTHROPIC_API_KEY"],
        message:
          "ANTHROPIC_API_KEY is required when AI_PROVIDER=claude. Set it, or set AI_PROVIDER=fake.",
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Parses server environment; blank values count as unset. `AI_PROVIDER` defaults to `claude`,
 * or `fake` under `NODE_ENV=test`. Throws naming what is wrong.
 */
export function parseServerEnv(
  source: Record<string, string | undefined>,
): ServerEnv {
  const set = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value?.trim()),
  );
  const result = serverEnvSchema.safeParse({
    ...set,
    AI_PROVIDER:
      set.AI_PROVIDER ?? (set.NODE_ENV === "test" ? "fake" : "claude"),
  });
  if (!result.success) {
    throw new Error(
      `Invalid server environment:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

let cached: ServerEnv | undefined;

/** Parses and caches server environment. Throws with a readable message when a variable is missing or invalid. */
export function getEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
