import { describe, expect, it } from "vitest";

import {
  MUSCLE_KEYS,
  heatColorStop,
  heatLabel,
  heatLevel,
} from "./heat";

// Доменная модель «нагрева» аватара: объём за 7 дней vs собственная норма
// (среднее недельное за прошлые недели) → серый (не тренировал) → красный
// (норма и выше). Чистая функция, единственный источник правды для цвета мышцы.

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

describe("heatLevel", () => {
  it("не тренировал на этой неделе (current=0, база есть) → dormant, t=0", () => {
    const h = heatLevel(0, 5000);
    expect(h.level).toBe("dormant");
    expect(h.t).toBe(0);
    expect(h.ratio).toBe(0);
  });

  it("никогда не тренировал (current=0, база=0) → dormant, ratio=null", () => {
    const h = heatLevel(0, 0);
    expect(h.level).toBe("dormant");
    expect(h.t).toBe(0);
    expect(h.ratio).toBeNull();
  });

  it("ровно норма (current=base) → high, ratio=1", () => {
    const h = heatLevel(5000, 5000);
    expect(h.ratio).toBe(1);
    expect(h.level).toBe("high");
  });

  it("сильно выше нормы (ratio ≥ 1.25) → peak, t=1", () => {
    const h = heatLevel(8000, 5000); // ratio 1.6
    expect(h.level).toBe("peak");
    expect(h.t).toBe(1);
  });

  it("половина нормы (0 < ratio < 0.5) → low", () => {
    const h = heatLevel(1000, 5000); // ratio 0.2
    expect(h.level).toBe("low");
    expect(h.t).toBeGreaterThan(0);
    expect(h.t).toBeLessThan(1);
  });

  it("около нормы (0.5 ≤ ratio < 1.0) → normal", () => {
    const h = heatLevel(3500, 5000); // ratio 0.7
    expect(h.level).toBe("normal");
  });

  it("новая мышца (база=0, тренировал) → high, ratio=null (норму не с чем сравнить)", () => {
    const h = heatLevel(2000, 0);
    expect(h.ratio).toBeNull();
    expect(h.level).toBe("high");
    expect(h.t).toBeGreaterThan(0.5);
    expect(h.t).toBeLessThan(1);
  });

  it("t монотонно растёт с объёмом при той же базе", () => {
    const a = heatLevel(1000, 5000);
    const b = heatLevel(3000, 5000);
    const c = heatLevel(6000, 5000);
    expect(a.t).toBeLessThan(b.t);
    expect(b.t).toBeLessThan(c.t);
  });
});

describe("heatColorStop", () => {
  it("t=0 → серый (нулевой нагрев)", () => {
    expect(heatColorStop(0)).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("границы дают разные цвета: серый ≠ красный", () => {
    expect(heatColorStop(0)).not.toBe(heatColorStop(1));
  });

  it("клампит выход за пределы [0,1]", () => {
    expect(heatColorStop(-1)).toBe(heatColorStop(0));
    expect(heatColorStop(2)).toBe(heatColorStop(1));
  });

  it("возвращает валидный hex для промежуточных значений", () => {
    expect(heatColorStop(0.5)).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("heatLabel", () => {
  it("каждому уровню — человекочитаемый RU-ярлык", () => {
    expect(heatLabel("dormant")).toBeTruthy();
    expect(heatLabel("peak")).toBeTruthy();
    expect(heatLabel("dormant")).not.toBe(heatLabel("peak"));
  });
});
