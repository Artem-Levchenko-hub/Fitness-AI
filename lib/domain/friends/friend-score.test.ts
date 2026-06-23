import { describe, expect, it } from "vitest";

import { extractOverallScore } from "./friend-score";

describe("extractOverallScore", () => {
  it("reads a valid integer overallScore", () => {
    expect(extractOverallScore({ overallScore: 82 })).toBe(82);
  });

  it("accepts the range edges 0 and 100", () => {
    expect(extractOverallScore({ overallScore: 0 })).toBe(0);
    expect(extractOverallScore({ overallScore: 100 })).toBe(100);
  });

  it("rounds a fractional score", () => {
    expect(extractOverallScore({ overallScore: 74.6 })).toBe(75);
  });

  it("returns null for out-of-range values", () => {
    expect(extractOverallScore({ overallScore: 101 })).toBeNull();
    expect(extractOverallScore({ overallScore: -1 })).toBeNull();
  });

  it("returns null when the field is missing or non-numeric", () => {
    expect(extractOverallScore({})).toBeNull();
    expect(extractOverallScore({ overallScore: "82" })).toBeNull();
    expect(extractOverallScore({ overallScore: null })).toBeNull();
    expect(extractOverallScore({ overallScore: Number.NaN })).toBeNull();
  });

  it("returns null for non-object / nullish resultJson (legacy markdown-only)", () => {
    expect(extractOverallScore(null)).toBeNull();
    expect(extractOverallScore(undefined)).toBeNull();
    expect(extractOverallScore("markdown")).toBeNull();
    expect(extractOverallScore(42)).toBeNull();
  });
});
