import { describe, expect, it } from "vitest";

import type { StrengthRecord } from "@/db/schema/strength-records";

import { formatStrengthValue, summarizeStrengthRecords } from "./strength-records";

function record(
  id: string,
  movement: StrengthRecord["movement"],
  value: number,
  performedAt: string,
  createdAt = "2026-08-12T12:00:00Z",
): StrengthRecord {
  return {
    id,
    userId: "user-1",
    movement,
    value,
    performedAt,
    createdAt: new Date(createdAt),
  };
}

describe("summarizeStrengthRecords", () => {
  it("keeps personal best separate from the latest result", () => {
    const result = summarizeStrengthRecords([
      record("older-best", "bench_press", 100, "2026-08-01"),
      record("latest", "bench_press", 95, "2026-08-10"),
    ]);

    expect(result.bench_press.personalBest?.id).toBe("older-best");
    expect(result.bench_press.latest?.id).toBe("latest");
    expect(result.bench_press.history.map((item) => item.id)).toEqual([
      "latest",
      "older-best",
    ]);
  });

  it("returns empty summaries for movements without results", () => {
    const result = summarizeStrengthRecords([]);

    expect(result.pull_up).toEqual({
      personalBest: null,
      latest: null,
      history: [],
    });
    expect(result.back_squat.personalBest).toBeNull();
  });
});

describe("formatStrengthValue", () => {
  it("does not add decimals to whole values", () => {
    expect(formatStrengthValue(12)).toBe("12");
    expect(formatStrengthValue(82.5)).toBe("82.5");
  });
});
