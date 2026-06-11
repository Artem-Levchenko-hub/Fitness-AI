import { describe, expect, it } from "vitest";

import {
  MUSCLE_KEYS,
  SETS_PEAK,
  heatColorStop,
  heatFromSets,
  heatLabel,
} from "./heat";

// Доменная модель «нагрева» аватара: АБСОЛЮТНОЕ число рабочих подходов на группу
// за неделю → серый (не тренировал) → красный (норма и выше). Норма ≈ SETS_PEAK
// подходов/нед (спорт-наука: 10–20 подходов/нед на группу для гипертрофии).
// 0 подходов → серый; ~5 → серо-красный; ≥SETS_PEAK → ярко-красный.

describe("MUSCLE_KEYS", () => {
  it("14 групп в каноническом порядке (зеркало pgEnum muscle_group_key)", () => {
    expect(MUSCLE_KEYS).toEqual([
      "chest",
      "back_lats",
      "back_traps",
      "shoulders_front",
      "shoulders_side",
      "shoulders_rear",
      "biceps",
      "triceps",
      "forearms",
      "core",
      "glutes",
      "quads",
      "hamstrings",
      "calves",
    ]);
  });
});

describe("heatFromSets", () => {
  it("0 подходов → серый (dormant), t=0", () => {
    const h = heatFromSets(0);
    expect(h.level).toBe("dormant");
    expect(h.t).toBe(0);
    expect(h.weeklySets).toBe(0);
  });

  it("норма и выше (≥ SETS_PEAK) → peak, t=1", () => {
    expect(heatFromSets(SETS_PEAK).level).toBe("peak");
    expect(heatFromSets(SETS_PEAK).t).toBe(1);
    expect(heatFromSets(SETS_PEAK + 10).t).toBe(1); // клампится
    expect(heatFromSets(SETS_PEAK + 10).level).toBe("peak");
  });

  it("~5 подходов → серо-красный (нагрев есть, но далеко не пик)", () => {
    const h = heatFromSets(5);
    expect(h.t).toBeGreaterThan(0.2);
    expect(h.t).toBeLessThan(0.5);
    expect(h.level).not.toBe("dormant");
    expect(h.level).not.toBe("peak");
  });

  it("t линейно растёт с числом подходов до пика", () => {
    expect(heatFromSets(3).t).toBeLessThan(heatFromSets(8).t);
    expect(heatFromSets(8).t).toBeLessThan(heatFromSets(13).t);
  });

  it("дробные подходы (secondary 0.5) поддерживаются", () => {
    const h = heatFromSets(7.5);
    expect(h.t).toBeCloseTo(7.5 / SETS_PEAK, 5);
  });
});

describe("heatColorStop", () => {
  it("t=0 → серый, t=1 → красный, разные", () => {
    expect(heatColorStop(0)).toMatch(/^#[0-9a-f]{6}$/i);
    expect(heatColorStop(0)).not.toBe(heatColorStop(1));
  });

  it("клампит выход за пределы [0,1]", () => {
    expect(heatColorStop(-1)).toBe(heatColorStop(0));
    expect(heatColorStop(2)).toBe(heatColorStop(1));
  });
});

describe("heatLabel", () => {
  it("каждому уровню — человекочитаемый RU-ярлык, dormant ≠ peak", () => {
    expect(heatLabel("dormant")).toBeTruthy();
    expect(heatLabel("peak")).toBeTruthy();
    expect(heatLabel("dormant")).not.toBe(heatLabel("peak"));
  });
});
