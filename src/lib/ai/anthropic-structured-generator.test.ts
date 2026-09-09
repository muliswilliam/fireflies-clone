import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  createAnthropicStructuredGenerator,
  SERVER_SIDE_FALLBACK_BETA,
  supportsServerSideFallbacks,
} from "@/lib/ai/anthropic-structured-generator";
import {
  ProviderError,
  type StructuredRequest,
} from "@/lib/ai/structured-generator";

const answerSchema = z.object({
  answer: z.string().min(1),
  confidence: z.int().min(0).max(100),
});

const REQUEST: StructuredRequest<z.infer<typeof answerSchema>> = {
  document: "Transcript",
  system: "You answer tersely.",
  prompt: "What is the capital of France?",
  schema: answerSchema,
  maxTokens: 4_000,
};

type SseEvent = { event: string; data: unknown };

/** A Messages API streaming response: one text block, then the given stop reason. */
function textStream(
  text: string | null,
  stop: { reason: string; details?: unknown } = { reason: "end_turn" },
): SseEvent[] {
  const events: SseEvent[] = [
    {
      event: "message_start",
      data: {
        type: "message_start",
        message: {
          id: "msg_test",
          type: "message",
          role: "assistant",
          model: "claude-opus-5",
          content: [],
          stop_reason: null,
          stop_sequence: null,
          stop_details: null,
          usage: { input_tokens: 25, output_tokens: 1 },
        },
      },
    },
  ];
  if (text !== null) {
    events.push(
      {
        event: "content_block_start",
        data: {
          type: "content_block_start",
          index: 0,
          content_block: { type: "text", text: "" },
        },
      },
      {
        event: "content_block_delta",
        data: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text },
        },
      },
      {
        event: "content_block_stop",
        data: { type: "content_block_stop", index: 0 },
      },
    );
  }
  events.push(
    {
      event: "message_delta",
      data: {
        type: "message_delta",
        delta: {
          stop_reason: stop.reason,
          stop_sequence: null,
          stop_details: stop.details ?? null,
        },
        usage: { output_tokens: 40 },
      },
    },
    { event: "message_stop", data: { type: "message_stop" } },
  );
  return events;
}

function sseResponse(events: SseEvent[]): Response {
  const body = events
    .map(
      ({ event, data }) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
    )
    .join("");
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

type Captured = {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
};

/** A generator over a client whose fetch is `respond`; records what it sent. */
function generatorWith(
  respond: () => Response | Promise<Response>,
  model = "claude-opus-5",
) {
  const captured: Captured[] = [];
  const client = new Anthropic({
    apiKey: "sk-ant-test",
    maxRetries: 0,
    fetch: async (url, init) => {
      captured.push({
        url: String(url),
        headers: new Headers(init?.headers as HeadersInit),
        body: JSON.parse(String(init?.body)),
      });
      return respond();
    },
  });
  return {
    captured,
    generator: createAnthropicStructuredGenerator({
      client,
      model,
    }),
  };
}

describe("Anthropic structured generator", () => {
  it("returns the model's JSON once it passes the Zod schema", async () => {
    const { generator } = generatorWith(() =>
      sseResponse(
        textStream(JSON.stringify({ answer: "Paris", confidence: 99 })),
      ),
    );
    await expect(generator.generate(REQUEST)).resolves.toEqual({
      answer: "Paris",
      confidence: 99,
    });
  });

  it("sends a streamed request with the model, adaptive thinking, fallbacks and the schema", async () => {
    const { generator, captured } = generatorWith(() =>
      sseResponse(
        textStream(JSON.stringify({ answer: "Paris", confidence: 99 })),
      ),
    );
    await generator.generate(REQUEST);

    expect(captured).toHaveLength(1);
    const [{ url, headers, body }] = captured;
    expect(url).toMatch(/\/v1\/messages\?beta=true$/);
    expect(headers.get("anthropic-beta")).toContain(SERVER_SIDE_FALLBACK_BETA);
    expect(body).toMatchObject({
      model: "claude-opus-5",
      max_tokens: 4_000,
      stream: true,
      fallbacks: "default",
      thinking: { type: "adaptive" },
      system: "You answer tersely.",
      messages: [{ role: "user", content: "What is the capital of France?" }],
    });
    const { effort, format } = body.output_config as {
      effort?: string;
      format: Record<string, unknown>;
    };
    expect(effort).toBeUndefined();
    expect(format.type).toBe("json_schema");
    expect(format.schema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["answer", "confidence"],
    });
  });

  it("leaves fallbacks out for a model that rejects the parameter", async () => {
    const { generator, captured } = generatorWith(
      () =>
        sseResponse(
          textStream(JSON.stringify({ answer: "Paris", confidence: 99 })),
        ),
      "claude-sonnet-5",
    );
    await generator.generate(REQUEST);

    const [{ headers, body }] = captured;
    expect(body.model).toBe("claude-sonnet-5");
    expect(body).not.toHaveProperty("fallbacks");
    expect(headers.get("anthropic-beta") ?? "").not.toContain(
      SERVER_SIDE_FALLBACK_BETA,
    );
  });

  it.each([
    ["claude-opus-5", true],
    ["claude-opus-5-20260401", true],
    ["claude-fable-5-1", true],
    ["claude-fable-5", true],
    ["claude-mythos-5-1", true],
    ["claude-sonnet-5", false],
    ["claude-opus-4-8", false],
    ["claude-haiku-4-5", false],
    ["claude-opus-50", false],
  ])("supportsServerSideFallbacks(%s) is %s", (model, expected) => {
    expect(supportsServerSideFallbacks(model)).toBe(expected);
  });

  it("passes the requested effort through", async () => {
    const { generator, captured } = generatorWith(() =>
      sseResponse(
        textStream(JSON.stringify({ answer: "Paris", confidence: 99 })),
      ),
    );
    await generator.generate({ ...REQUEST, effort: "low" });
    expect(captured[0].body.output_config).toMatchObject({ effort: "low" });
  });

  it("rejects output that the Zod schema refuses, naming the document and the problem", async () => {
    const { generator } = generatorWith(() =>
      sseResponse(textStream(JSON.stringify({ answer: "", confidence: 150 }))),
    );
    const failure = generator.generate(REQUEST);
    await expect(failure).rejects.toBeInstanceOf(ProviderError);
    await expect(failure).rejects.toThrowError(
      /The model returned an invalid Transcript: .*answer/,
    );
  });

  it("rejects output that is not JSON at all", async () => {
    const { generator } = generatorWith(() =>
      sseResponse(textStream("Sorry, here is prose instead of JSON.")),
    );
    await expect(generator.generate(REQUEST)).rejects.toThrowError(
      /The model returned an invalid Transcript: not valid JSON/,
    );
  });

  it("surfaces a refusal, with its category, before looking at the content", async () => {
    const { generator } = generatorWith(() =>
      sseResponse(
        textStream(null, {
          reason: "refusal",
          details: { type: "refusal", category: "cyber", explanation: null },
        }),
      ),
    );
    const failure = generator.generate(REQUEST);
    await expect(failure).rejects.toBeInstanceOf(ProviderError);
    await expect(failure).rejects.toThrowError(
      /Claude declined to produce the Transcript \(cyber\)/,
    );
  });

  it("surfaces an answer cut off by max_tokens instead of parsing half a document", async () => {
    const { generator } = generatorWith(() =>
      sseResponse(textStream('{"answer": "Par', { reason: "max_tokens" })),
    );
    await expect(generator.generate(REQUEST)).rejects.toThrowError(
      /Claude's Transcript was cut off/,
    );
  });

  it("surfaces API errors with their status", async () => {
    const { generator } = generatorWith(
      () =>
        new Response(
          JSON.stringify({
            type: "error",
            error: { type: "api_error", message: "Overloaded" },
          }),
          { status: 529, headers: { "content-type": "application/json" } },
        ),
    );
    const failure = generator.generate(REQUEST);
    await expect(failure).rejects.toBeInstanceOf(ProviderError);
    await expect(failure).rejects.toThrowError(/Claude API error 529/);
  });

  it("names the API key when authentication fails", async () => {
    const { generator } = generatorWith(
      () =>
        new Response(
          JSON.stringify({
            type: "error",
            error: {
              type: "authentication_error",
              message: "invalid x-api-key",
            },
          }),
          { status: 401, headers: { "content-type": "application/json" } },
        ),
    );
    await expect(generator.generate(REQUEST)).rejects.toThrowError(
      /ANTHROPIC_API_KEY/,
    );
  });

  it("surfaces connection failures", async () => {
    const { generator } = generatorWith(() => {
      throw new TypeError("fetch failed");
    });
    const failure = generator.generate(REQUEST);
    await expect(failure).rejects.toBeInstanceOf(ProviderError);
    await expect(failure).rejects.toThrowError(
      /Could not reach the Claude API/,
    );
  });
});
