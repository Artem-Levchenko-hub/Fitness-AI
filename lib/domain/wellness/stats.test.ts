import { describe, expect, it } from "vitest";

import { buildWellnessSeries, wellnessAchievements, wellnessRange } from "./stats";

describe("daily wellness statistics", () => {
  it("uses exactly the selected number of local calendar days, including today", () => {
    expect(wellnessRange("7d", new Date("2026-11-23T23:30:00Z"), "Europe/Moscow")).toEqual({
      from: "2026-11-18", to: "2026-11-24",
    });
    expect(wellnessRange("all", new Date("2026-11-23T23:30:00Z"), "Europe/Moscow")).toEqual({
      from: "0001-01-01", to: "2026-11-24",
    });
  });

  it("keeps missing days empty and averages only recorded values, including zero", () => {
    expect(buildWellnessSeries(
      [{ date: "2026-11-22", hours: 6 }, { date: "2026-11-24", hours: 0 }, { date: "2026-11-25", hours: 9 }],
      [{ date: "2026-11-22", proteinG: 120 }, { date: "2026-11-23", proteinG: null }, { date: "2026-11-24", proteinG: 0 }],
      { from: "2026-11-22", to: "2026-11-24" },
    )).toEqual({
      days: [
        { date: "2026-11-22", hours: 6, proteinG: 120 },
        { date: "2026-11-23", hours: null, proteinG: null },
        { date: "2026-11-24", hours: 0, proteinG: 0 },
      ],
      sleepDays: 2, proteinDays: 2, averageSleep: 3, averageProtein: 60,
    });
  });

  it("starts an all-time series at its first entry and returns null averages when empty", () => {
    expect(buildWellnessSeries([], [], { from: "0001-01-01", to: "2026-11-24" })).toEqual({
      days: [], sleepDays: 0, proteinDays: 0, averageSleep: null, averageProtein: null,
    });
    expect(buildWellnessSeries([], [{ date: "2026-11-23", proteinG: 100 }], { from: "0001-01-01", to: "2026-11-24" }).days).toEqual([
      { date: "2026-11-23", hours: null, proteinG: 100 },
      { date: "2026-11-24", hours: null, proteinG: null },
    ]);
  });

  it("does not extend all-time protein history for nutrition entries with no protein recorded", () => {
    expect(buildWellnessSeries([], [
      { date: "2026-01-01", proteinG: null },
      { date: "2026-11-24", proteinG: 130 },
    ], { from: "0001-01-01", to: "2026-11-24" }).days).toEqual([
      { date: "2026-11-24", hours: null, proteinG: 130 },
    ]);
  });

  it("unlocks 7 and 30 recorded-day milestones separately for sleep and protein", () => {
    expect(wellnessAchievements({ sleepDays: 7, proteinDays: 30 })).toEqual([
      { key: "sleep-7", kind: "sleep", days: 7, current: 7, earned: true },
      { key: "sleep-30", kind: "sleep", days: 30, current: 7, earned: false },
      { key: "protein-7", kind: "protein", days: 7, current: 30, earned: true },
      { key: "protein-30", kind: "protein", days: 30, current: 30, earned: true },
    ]);
  });
});
