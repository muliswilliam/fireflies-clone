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

/** StructuredGenerator over the official Anthropic SDK: one streamed call, adaptive thinking, structured output. */
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
  // Only the derived JSON Schema is sent; parseStructuredOutput validates so failures name the issue.
  const { schema } = betaZodOutputFormat(request.schema);
  try {
    // Streaming keeps long generations clear of HTTP timeouts.
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

/** The answer text, after checking the stop reason. */
function textOf<T>(
  request: StructuredRequest<T>,
  message: Anthropic.Beta.BetaMessage,
): string {
  const { document } = request;
  // A refusal may carry no content, so check it first.
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

/** SDK failures, most specific first, in the words a failed Meeting shows. */
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
