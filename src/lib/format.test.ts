import { describe, expect, it } from "vitest";

import { formatDuration, formatTimestamp } from "@/lib/format";

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

describe("formatTimestamp", () => {
  it("shows mm:ss relative to the Recording start", () => {
    expect(formatTimestamp(0)).toBe("00:00");
    expect(formatTimestamp(65_400)).toBe("01:05");
    expect(formatTimestamp(59 * 60_000 + 59_999)).toBe("59:59");
  });

  it("adds hours once a Recording passes an hour", () => {
    expect(formatTimestamp(60 * 60_000)).toBe("1:00:00");
    expect(formatTimestamp(2 * 60 * 60_000 + 5 * 60_000 + 3_000)).toBe(
      "2:05:03",
    );
  });

  it("never shows a negative time", () => {
    expect(formatTimestamp(-500)).toBe("00:00");
  });
});
