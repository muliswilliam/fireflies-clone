import { describe, expect, it } from "vitest";

import { formatDuration } from "@/lib/format";

describe("formatDuration", () => {
  it("shows seconds under a minute", () => {
    expect(formatDuration(45_000)).toBe("45 s");
  });

  it("shows whole minutes under an hour", () => {
    expect(formatDuration(32 * 60_000 + 20_000)).toBe("32 min");
  });

  it("shows hours with zero-padded minutes", () => {
    expect(formatDuration(65 * 60_000)).toBe("1 h 05 min");
  });
});
