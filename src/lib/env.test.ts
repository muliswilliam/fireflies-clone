import { describe, expect, it } from "vitest";

import { parseServerEnv } from "@/lib/env";

const DATABASE_URL =
  "postgres://postgres:postgres@localhost:5433/firefly_notes";

describe("server environment", () => {
  it("defaults to the claude provider and the claude-opus-5 model outside tests", () => {
    const env = parseServerEnv({
      DATABASE_URL,
      NODE_ENV: "production",
      ANTHROPIC_API_KEY: "sk-ant-test",
    });
    expect(env.AI_PROVIDER).toBe("claude");
    expect(env.AI_MODEL).toBe("claude-opus-5");
    expect(env.ANTHROPIC_API_KEY).toBe("sk-ant-test");
  });

  it("defaults to the fake provider under NODE_ENV=test so tests never pay for Claude", () => {
    const env = parseServerEnv({ DATABASE_URL, NODE_ENV: "test" });
    expect(env.AI_PROVIDER).toBe("fake");
  });

  it("lets AI_PROVIDER override the default in any environment", () => {
    const env = parseServerEnv({
      DATABASE_URL,
      NODE_ENV: "production",
      AI_PROVIDER: "fake",
    });
    expect(env.AI_PROVIDER).toBe("fake");
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it("reads AI_MODEL", () => {
    const env = parseServerEnv({
      DATABASE_URL,
      AI_PROVIDER: "claude",
      ANTHROPIC_API_KEY: "sk-ant-test",
      AI_MODEL: "claude-sonnet-5",
    });
    expect(env.AI_MODEL).toBe("claude-sonnet-5");
  });

  it("fails with a clear message when the claude provider has no ANTHROPIC_API_KEY", () => {
    expect(() =>
      parseServerEnv({ DATABASE_URL, AI_PROVIDER: "claude" }),
    ).toThrowError(/ANTHROPIC_API_KEY is required when AI_PROVIDER=claude/);
  });

  it("treats a blank ANTHROPIC_API_KEY as missing", () => {
    expect(() =>
      parseServerEnv({
        DATABASE_URL,
        AI_PROVIDER: "claude",
        ANTHROPIC_API_KEY: "  ",
      }),
    ).toThrowError(/ANTHROPIC_API_KEY is required/);
  });

  it("treats blank values as unset, so a copied .env.example still gets defaults", () => {
    const env = parseServerEnv({
      DATABASE_URL,
      AI_PROVIDER: "",
      AI_MODEL: "",
      NODE_ENV: "test",
    });
    expect(env.AI_PROVIDER).toBe("fake");
    expect(env.AI_MODEL).toBe("claude-opus-5");
  });

  it("does not require ANTHROPIC_API_KEY for the fake provider", () => {
    expect(() =>
      parseServerEnv({ DATABASE_URL, AI_PROVIDER: "fake" }),
    ).not.toThrow();
  });

  it("names the broken variable when DATABASE_URL is missing", () => {
    expect(() => parseServerEnv({ AI_PROVIDER: "fake" })).toThrowError(
      /DATABASE_URL/,
    );
  });
});
