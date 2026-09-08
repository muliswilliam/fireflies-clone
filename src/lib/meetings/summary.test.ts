import { describe, expect, it } from "vitest";

import {
  summarizationOutputSchema,
  summarizationOutputSchemaFor,
  summarySchema,
} from "@/lib/meetings/summary";

const SPEAKER_A = "11111111-1111-4111-8111-111111111111";
const SPEAKER_B = "22222222-2222-4222-8222-222222222222";
const STRANGER = "99999999-9999-4999-8999-999999999999";

const SUMMARY = {
  overview: "The team met to agree the Q3 roadmap.",
  keyTakeaways: ["Ship the beta first", "Delay the redesign", "Hire one more"],
};

const ITEM = {
  text: "Draft the beta announcement",
  ownerSpeakerId: SPEAKER_A,
  dueDate: "Friday",
};

describe("summarySchema", () => {
  it("accepts a well-formed Summary", () => {
    expect(summarySchema.parse(SUMMARY)).toEqual(SUMMARY);
  });

  it("rejects a blank Overview", () => {
    expect(summarySchema.safeParse({ ...SUMMARY, overview: " " }).success).toBe(
      false,
    );
  });

  it("rejects fewer than 3 or more than 7 Key Takeaways", () => {
    expect(
      summarySchema.safeParse({ ...SUMMARY, keyTakeaways: ["One", "Two"] })
        .success,
    ).toBe(false);
    expect(
      summarySchema.safeParse({
        ...SUMMARY,
        keyTakeaways: Array.from({ length: 8 }, (_, i) => `Point ${i}`),
      }).success,
    ).toBe(false);
  });

  it("rejects a blank Key Takeaway", () => {
    expect(
      summarySchema.safeParse({
        ...SUMMARY,
        keyTakeaways: ["One", "  ", "Three"],
      }).success,
    ).toBe(false);
  });
});

describe("summarizationOutputSchema", () => {
  it("accepts a Summary with Action Items, including unowned and undated ones", () => {
    const parsed = summarizationOutputSchema.parse({
      ...SUMMARY,
      actionItems: [ITEM, { ...ITEM, ownerSpeakerId: null, dueDate: null }],
    });
    expect(parsed.actionItems).toHaveLength(2);
  });

  it("accepts no Action Items at all", () => {
    expect(
      summarizationOutputSchema.safeParse({ ...SUMMARY, actionItems: [] })
        .success,
    ).toBe(true);
  });

  it("rejects more than 10 Action Items", () => {
    expect(
      summarizationOutputSchema.safeParse({
        ...SUMMARY,
        actionItems: Array.from({ length: 11 }, () => ITEM),
      }).success,
    ).toBe(false);
  });

  it("rejects an Action Item without text or with an owner that is not a uuid", () => {
    expect(
      summarizationOutputSchema.safeParse({
        ...SUMMARY,
        actionItems: [{ ...ITEM, text: "" }],
      }).success,
    ).toBe(false);
    expect(
      summarizationOutputSchema.safeParse({
        ...SUMMARY,
        actionItems: [{ ...ITEM, ownerSpeakerId: "Amara" }],
      }).success,
    ).toBe(false);
  });

  it("rejects output that is missing the Action Items entirely", () => {
    expect(summarizationOutputSchema.safeParse(SUMMARY).success).toBe(false);
  });
});

describe("summarizationOutputSchemaFor", () => {
  const schema = summarizationOutputSchemaFor({
    speakerIds: [SPEAKER_A, SPEAKER_B],
  });

  it("accepts owners who are Speakers in the Meeting", () => {
    expect(
      schema.safeParse({
        ...SUMMARY,
        actionItems: [ITEM, { ...ITEM, ownerSpeakerId: SPEAKER_B }],
      }).success,
    ).toBe(true);
  });

  it("rejects an owner who is not a Speaker in the Meeting and points at the item", () => {
    const result = schema.safeParse({
      ...SUMMARY,
      actionItems: [ITEM, { ...ITEM, ownerSpeakerId: STRANGER }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ["actionItems", 1, "ownerSpeakerId"],
      message: "Action Item owner is not a Speaker in the Meeting",
    });
  });
});
