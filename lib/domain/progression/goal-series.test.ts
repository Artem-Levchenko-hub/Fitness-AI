import { describe, expect, it } from "vitest";

import { goalSeries, type GoalSeriesSession } from "./goal-series";

/** Сессии «новые сверху» — как отдаёт stats.repo.exerciseSetHistory. */
function session(
  best1rm: number,
  working: number[],
  warmup: number[] = [],
): GoalSeriesSession {
  return {
    best1rm,
    sets: [
      ...working.map((w) => ({ setType: "working", weightKg: w })),
      ...warmup.map((w) => ({ setType: "warmup", weightKg: w })),
    ],
  };
}

describe("goalSeries", () => {
  it("пустая история → пустая серия (любой вид)", () => {
    expect(goalSeries([], "1rm")).toEqual([]);
    expect(goalSeries([], "weight")).toEqual([]);
  });

  it("1rm: best1rm по сессиям, новые-сверху → хронологический старое→новое", () => {
    const history = [session(110, [100]), session(105, [95]), session(100, [90])];
    expect(goalSeries(history, "1rm")).toEqual([100, 105, 110]);
  });

  it("1rm: сессии с best1rm=0 (только разминка) исключены", () => {
    const history = [session(110, [100]), session(0, [], [40, 50]), session(100, [90])];
    expect(goalSeries(history, "1rm")).toEqual([100, 110]);
  });

  it("weight: макс рабочий вес по сессии, новые-сверху → хронологический", () => {
    const history = [
      session(0, [82.5, 80]),
      session(0, [77.5, 75]),
      session(0, [72.5, 70]),
    ];
    expect(goalSeries(history, "weight")).toEqual([72.5, 77.5, 82.5]);
  });

  it("weight: сессия без working-сетов (только разминка) исключена", () => {
    const history = [session(0, [80]), session(0, [], [40, 45]), session(0, [70])];
    expect(goalSeries(history, "weight")).toEqual([70, 80]);
  });

  it("weight: разминочные веса не влияют на макс рабочего", () => {
    // разминка 90 тяжелее рабочих 70/72.5 — игнорируется
    const history = [session(0, [72.5, 70], [90])];
    expect(goalSeries(history, "weight")).toEqual([72.5]);
  });
});
