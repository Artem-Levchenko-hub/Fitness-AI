import { describe, expect, it } from "vitest";

import {
  bestEstimatedOneRepMax,
  brzyckiOneRepMax,
  epleyOneRepMax,
  estimatedOneRepMax,
} from "./one-rep-max";

describe("epleyOneRepMax", () => {
  it("reps = 1 → сам вес", () => {
    expect(epleyOneRepMax(100, 1)).toBe(100);
  });
  it("reps < 1 → 0 (формула не определена)", () => {
    expect(epleyOneRepMax(100, 0)).toBe(0);
  });
  it("weight × (1 + reps/30)", () => {
    expect(epleyOneRepMax(100, 5)).toBeCloseTo(116.667, 2);
    expect(epleyOneRepMax(100, 10)).toBeCloseTo(133.333, 2);
  });
});

describe("brzyckiOneRepMax", () => {
  it("reps = 1 → сам вес", () => {
    expect(brzyckiOneRepMax(100, 1)).toBe(100);
  });
  it("reps < 1 → 0", () => {
    expect(brzyckiOneRepMax(100, 0)).toBe(0);
  });
  it("weight × 36 / (37 - reps)", () => {
    expect(brzyckiOneRepMax(100, 5)).toBeCloseTo(112.5, 2);
    expect(brzyckiOneRepMax(100, 10)).toBeCloseTo(133.333, 2);
  });
  it("reps >= 37 → 0 (знаменатель <= 0, не определена)", () => {
    expect(brzyckiOneRepMax(100, 37)).toBe(0);
    expect(brzyckiOneRepMax(100, 40)).toBe(0);
  });
});

describe("estimatedOneRepMax — среднее валидных оценок", () => {
  it("weight <= 0 или reps < 1 → 0", () => {
    expect(estimatedOneRepMax(0, 5)).toBe(0);
    expect(estimatedOneRepMax(-10, 5)).toBe(0);
    expect(estimatedOneRepMax(100, 0)).toBe(0);
  });
  it("reps = 1 → сам вес", () => {
    expect(estimatedOneRepMax(120, 1)).toBe(120);
  });
  it("в диапазоне 1-36 reps усредняет Epley и Brzycki", () => {
    // (116.667 + 112.5) / 2 = 114.583
    expect(estimatedOneRepMax(100, 5)).toBeCloseTo(114.583, 2);
  });
  it("reps >= 37 (Brzycki не определён) → Epley в одиночку, НЕ вдвое занижено", () => {
    // Регрессионный тест на баг: раньше было (epley + 0)/2 = половина.
    const epley = epleyOneRepMax(100, 40); // 100 * (1 + 40/30) = 233.333
    expect(estimatedOneRepMax(100, 40)).toBeCloseTo(epley, 5);
    expect(estimatedOneRepMax(100, 40)).toBeCloseTo(233.333, 2);
    // Защита от прежнего поведения: НЕ половина Epley.
    expect(estimatedOneRepMax(100, 40)).toBeGreaterThan(epley / 2 + 1);
  });
});

describe("bestEstimatedOneRepMax", () => {
  it("берёт максимум по working-подходам", () => {
    const best = bestEstimatedOneRepMax([
      { weightKg: 100, reps: 5 },
      { weightKg: 110, reps: 3 },
      { weightKg: 90, reps: 8 },
    ]);
    expect(best).toBeCloseTo(estimatedOneRepMax(110, 3), 5);
  });
  it("игнорирует warmup/drop/failure", () => {
    const best = bestEstimatedOneRepMax([
      { weightKg: 60, reps: 5, setType: "working" },
      { weightKg: 200, reps: 1, setType: "warmup" },
      { weightKg: 180, reps: 2, setType: "drop" },
    ]);
    expect(best).toBeCloseTo(estimatedOneRepMax(60, 5), 5);
  });
  it("подходы без setType считаются working", () => {
    const best = bestEstimatedOneRepMax([{ weightKg: 100, reps: 5 }]);
    expect(best).toBeCloseTo(estimatedOneRepMax(100, 5), 5);
  });
  it("пустой массив → 0", () => {
    expect(bestEstimatedOneRepMax([])).toBe(0);
  });
});
