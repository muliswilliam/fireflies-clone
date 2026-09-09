import type { z } from "zod";

import {
  describeFirstIssue,
  type ProviderDocument,
} from "@/lib/meetings/provider-output";

/**
 * One model call that must answer with JSON matching a Zod schema. The prompts depend on this
 * seam; the vendor lives only in its implementation (`anthropic-structured-generator.ts`).
 */
export interface StructuredGenerator {
  generate<T>(request: StructuredRequest<T>): Promise<T>;
}

export type StructuredRequest<T> = {
  /** Which Meeting document the answer is; only used to word errors. */
  document: ProviderDocument;
  system: string;
  prompt: string;
  /** The answer must satisfy this schema; its JSON Schema is sent as the output format. */
  schema: z.ZodType<T>;
  maxTokens: number;
  /** How much the model may reason before answering; omitted means the vendor's default. */
  effort?: Effort;
};

export type Effort = "low" | "medium" | "high";

/** Anything that stops a provider from delivering: refusals, invalid output, API and network errors. */
export class ProviderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ProviderError";
  }
}

/** JSON-parses and validates the model text; anything wrong is a ProviderError naming the issue. */
export function parseStructuredOutput<T>(
  request: StructuredRequest<T>,
  text: string,
): T {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ProviderError(
      `The model returned an invalid ${request.document}: not valid JSON`,
    );
  }
  const result = request.schema.safeParse(json);
  if (!result.success) {
    throw new ProviderError(
      `The model returned an invalid ${request.document}: ${describeFirstIssue(result.error)}`,
    );
  }
  return result.data;
}
