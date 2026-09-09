import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

import {
  parseStructuredOutput,
  ProviderError,
  type StructuredGenerator,
  type StructuredRequest,
} from "./structured-generator";

/** Beta header for `fallbacks: "default"`: a refusal is re-run server-side on Anthropic's recommended model. */
export const SERVER_SIDE_FALLBACK_BETA = "server-side-fallback-2026-07-01";

export type AnthropicStructuredGeneratorConfig = {
  client: Anthropic;
  model: string;
};

/**
 * The StructuredGenerator over the official Anthropic SDK: one streamed Messages call with
 * adaptive thinking and structured output. The only module that knows the vendor.
 */
export function createAnthropicStructuredGenerator(
  config: AnthropicStructuredGeneratorConfig,
): StructuredGenerator {
  return {
    async generate<T>(request: StructuredRequest<T>): Promise<T> {
      const message = await requestMessage(config, request);
      return parseStructuredOutput(request, textOf(request, message));
    },
  };
}

async function requestMessage<T>(
  { client, model }: AnthropicStructuredGeneratorConfig,
  request: StructuredRequest<T>,
): Promise<Anthropic.Beta.BetaMessage> {
  // The SDK's Zod helper derives the JSON Schema (and strips what the API does not accept).
  // Only its schema is sent: validation is done by parseStructuredOutput so a rejected answer names the issue.
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
        output_config: {
          effort: request.effort,
          format: { type: "json_schema", schema },
        },
        system: request.system,
        messages: [{ role: "user", content: request.prompt }],
      })
      .finalMessage();
  } catch (error) {
    throw toProviderError(error);
  }
}

/** The answer's text, once the stop reason says there is a complete answer to read. */
function textOf<T>(
  request: StructuredRequest<T>,
  message: Anthropic.Beta.BetaMessage,
): string {
  const { document } = request;
  // A refusal can arrive with no content at all, so it is checked before the content is read.
  if (message.stop_reason === "refusal") {
    const category = message.stop_details?.category;
    throw new ProviderError(
      `Claude declined to produce the ${document}${category ? ` (${category})` : ""}`,
    );
  }
  if (message.stop_reason === "max_tokens") {
    throw new ProviderError(
      `Claude's ${document} was cut off before it was complete`,
    );
  }
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

/** Wraps SDK failures, most specific first, in the words a failed Meeting shows. */
function toProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (error instanceof Anthropic.AuthenticationError) {
    return new ProviderError(
      "Claude rejected the API key; check ANTHROPIC_API_KEY",
      { cause: error },
    );
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new ProviderError(
      "Claude API rate limit reached; retry in a moment",
      { cause: error },
    );
  }
  // APIConnectionError extends APIError, so it has to be recognised first.
  if (error instanceof Anthropic.APIConnectionError) {
    return new ProviderError(
      `Could not reach the Claude API: ${error.message}`,
      { cause: error },
    );
  }
  if (error instanceof Anthropic.APIError) {
    return new ProviderError(
      `Claude API error ${error.status}: ${error.message}`,
      { cause: error },
    );
  }
  if (error instanceof Anthropic.AnthropicError) {
    return new ProviderError(`Claude SDK error: ${error.message}`, {
      cause: error,
    });
  }
  return new ProviderError(
    error instanceof Error ? error.message : String(error),
    { cause: error },
  );
}
