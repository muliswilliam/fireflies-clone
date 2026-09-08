import { z } from "zod";

export const AI_PROVIDERS = ["claude", "fake"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const DEFAULT_AI_MODEL = "claude-opus-5";

/** A blank value in `.env` (`ANTHROPIC_API_KEY=`) means "not set", not "the empty string". */
const optionalSecret = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const serverEnvSchema = z
  .object({
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    /** Which implementation generates Transcripts and Summaries (ADR-0001). */
    AI_PROVIDER: z.enum(AI_PROVIDERS),
    /** Claude model id used by the `claude` provider. */
    AI_MODEL: z.string().trim().min(1).default(DEFAULT_AI_MODEL),
    /** Required by the `claude` provider; ignored by `fake`. */
    ANTHROPIC_API_KEY: optionalSecret,
    /** Global cap on non-sample Meetings created in any rolling 24 hours (ADR-0005). */
    MAX_MEETINGS_PER_DAY: z.coerce.number().int().positive().default(50),
    /** Test only: lets a Meeting title ask a provider to fail once (`src/lib/ai/fault-injection.ts`). */
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
 * Parses server environment from `source` (normally `process.env`).
 * `AI_PROVIDER` defaults to `claude`, except under `NODE_ENV=test` where it is `fake` so
 * tests and e2e never pay for Claude unless they ask to. Throws with every broken variable named.
 */
export function parseServerEnv(
  source: Record<string, string | undefined>,
): ServerEnv {
  const result = serverEnvSchema.safeParse({
    ...source,
    AI_PROVIDER:
      source.AI_PROVIDER ?? (source.NODE_ENV === "test" ? "fake" : "claude"),
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
