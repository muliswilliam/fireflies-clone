import type { z } from "zod";

import {
  describeFirstIssue,
  type ProviderDocument,
} from "@/lib/meetings/provider-output";

/**
 * The seam between the prompts and the model vendor. A StructuredGenerator makes one model
 * call that must answer with a JSON document matching a Zod schema. The Transcript and Summary
 * providers are prompts over this interface and know nothing about which vendor answers;
 * `anthropic-structured-generator.ts` is the one implementation, and another vendor is one
 * more file plus a case in the provider factory.
 */
export interface StructuredGenerator {
  generate<T>(request: StructuredRequest<T>): Promise<T>;
}

export type StructuredRequest<T> = {
  /** Which Meeting document the answer is; only used to word errors. */
  document: ProviderDocument;
  system: string;
  prompt: string;
  /** The response must satisfy this schema; implementations send its JSON Schema as the output format. */
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

/** Parses the model's text as JSON and checks it against the request's schema; anything wrong is a ProviderError naming the issue. */
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
