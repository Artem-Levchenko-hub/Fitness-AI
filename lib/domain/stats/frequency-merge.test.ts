import { describe, expect, it } from "vitest";

import { mergeDailyFrequency } from "./frequency-merge";

describe("mergeDailyFrequency", () => {
  it("returns [] for no sources / all empty", () => {
    expect(mergeDailyFrequency([])).toEqual([]);
    expect(mergeDailyFrequency([[], []])).toEqual([]);
  });

  it("passes a single source through, sorted by date asc", () => {
    expect(
      mergeDailyFrequency([
        [
          { date: "2026-06-10", count: 2 },
          { date: "2026-06-08", count: 1 },
        ],
      ]),
    ).toEqual([
      { date: "2026-06-08", count: 1 },
      { date: "2026-06-10", count: 2 },
    ]);
  });

  it("sums counts for the same date across formats", () => {
    const strength = [{ date: "2026-06-09", count: 1 }];
    const circuit = [{ date: "2026-06-09", count: 2 }];
    const cardio = [{ date: "2026-06-09", count: 1 }];
    expect(mergeDailyFrequency([strength, circuit, cardio])).toEqual([
      { date: "2026-06-09", count: 4 },
    ]);
  });

  it("merges distinct days from different formats", () => {
    const strength = [{ date: "2026-06-09", count: 1 }];
    const cardio = [{ date: "2026-06-11", count: 1 }];
    expect(mergeDailyFrequency([strength, cardio])).toEqual([
      { date: "2026-06-09", count: 1 },
      { date: "2026-06-11", count: 1 },
    ]);
  });

  it("handles overlap + distinct together", () => {
    const a = [
      { date: "2026-06-09", count: 1 },
      { date: "2026-06-10", count: 1 },
    ];
    const b = [
      { date: "2026-06-10", count: 3 },
      { date: "2026-06-12", count: 2 },
    ];
    expect(mergeDailyFrequency([a, b])).toEqual([
      { date: "2026-06-09", count: 1 },
      { date: "2026-06-10", count: 4 },
      { date: "2026-06-12", count: 2 },
    ]);
  });
});
