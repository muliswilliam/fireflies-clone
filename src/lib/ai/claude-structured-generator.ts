import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

import {
  describeFirstIssue,
  type ProviderDocument,
} from "@/lib/meetings/provider-output";

/** Beta header for `fallbacks: "default"`: a refusal is re-run server-side on Anthropic's recommended model. */
export const SERVER_SIDE_FALLBACK_BETA = "server-side-fallback-2026-07-01";

export type StructuredRequest<T> = {
  /** Which Meeting document the answer is; only used to word errors. */
  document: ProviderDocument;
  system: string;
  prompt: string;
  /** The response must satisfy this schema; its JSON Schema is sent as the output format. */
  schema: z.ZodType<T>;
  maxTokens: number;
};

/**
 * One Claude call that must answer with a JSON document matching a Zod schema.
 * Both Claude providers are thin prompts over this; it owns the SDK details and error wording.
 */
export interface ClaudeStructuredGenerator {
  generate<T>(request: StructuredRequest<T>): Promise<T>;
}

/** Anything that stops a Claude provider from delivering: refusals, invalid output, API and network errors. */
export class ClaudeProviderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ClaudeProviderError";
  }
}

export type ClaudeStructuredGeneratorConfig = {
  client: Anthropic;
  model: string;
};

export function createClaudeStructuredGenerator(
  config: ClaudeStructuredGeneratorConfig,
): ClaudeStructuredGenerator {
  return {
    async generate<T>(request: StructuredRequest<T>): Promise<T> {
      const message = await requestMessage(config, request);
      return parseStructuredOutput(request, message);
    },
  };
}

async function requestMessage<T>(
  { client, model }: ClaudeStructuredGeneratorConfig,
  request: StructuredRequest<T>,
): Promise<Anthropic.Beta.BetaMessage> {
  // The SDK's Zod helper derives the JSON Schema (and strips what the API does not accept).
  // Only its schema is sent: validation is done here so a rejected answer names the issue.
  const { schema } = betaZodOutputFormat(request.schema);
  try {
    // Streaming keeps a long generation clear of HTTP timeouts; finalMessage() assembles it.
    return await client.beta.messages
      .stream({
        model,
        max_tokens: request.maxTokens,
        betas: [SERVER_SIDE_FALLBACK_BETA],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { format: { type: "json_schema", schema } },
        system: request.system,
        messages: [{ role: "user", content: request.prompt }],
      })
      .finalMessage();
  } catch (error) {
    throw toProviderError(error);
  }
}

function parseStructuredOutput<T>(
  request: StructuredRequest<T>,
  message: Anthropic.Beta.BetaMessage,
): T {
  const { document } = request;
  // A refusal can arrive with no content at all, so it is checked before the content is read.
  if (message.stop_reason === "refusal") {
    const category = message.stop_details?.category;
    throw new ClaudeProviderError(
      `Claude declined to produce the ${document}${category ? ` (${category})` : ""}`,
    );
  }
  if (message.stop_reason === "max_tokens") {
    throw new ClaudeProviderError(
      `Claude's ${document} was cut off before it was complete`,
    );
  }

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ClaudeProviderError(
      `Claude returned an invalid ${document}: not valid JSON`,
    );
  }

  const result = request.schema.safeParse(json);
  if (!result.success) {
    throw new ClaudeProviderError(
      `Claude returned an invalid ${document}: ${describeFirstIssue(result.error)}`,
    );
  }
  return result.data;
}

/** Wraps SDK failures, most specific first, in the words a failed Meeting shows. */
function toProviderError(error: unknown): ClaudeProviderError {
  if (error instanceof ClaudeProviderError) return error;
  if (error instanceof Anthropic.AuthenticationError) {
    return new ClaudeProviderError(
      "Claude rejected the API key; check ANTHROPIC_API_KEY",
      { cause: error },
    );
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new ClaudeProviderError(
      "Claude API rate limit reached; retry in a moment",
      { cause: error },
    );
  }
  // APIConnectionError extends APIError, so it has to be recognised first.
  if (error instanceof Anthropic.APIConnectionError) {
    return new ClaudeProviderError(
      `Could not reach the Claude API: ${error.message}`,
      { cause: error },
    );
  }
  if (error instanceof Anthropic.APIError) {
    return new ClaudeProviderError(
      `Claude API error ${error.status}: ${error.message}`,
      { cause: error },
    );
  }
  if (error instanceof Anthropic.AnthropicError) {
    return new ClaudeProviderError(`Claude SDK error: ${error.message}`, {
      cause: error,
    });
  }
  return new ClaudeProviderError(
    error instanceof Error ? error.message : String(error),
    { cause: error },
  );
}
