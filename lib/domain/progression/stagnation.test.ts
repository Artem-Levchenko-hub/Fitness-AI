import { describe, expect, it } from "vitest";

import { detectStagnation } from "./stagnation";

/** H11.4 — detectStagnation = свёртка ПОВЕРХ примитива trendStatus (он сравнивает
 *  две точки prev→cur, не серию). Считаем хвост подряд идущих НЕулучшающих
 *  переходов e1RM от новейшего конца; n подряд {stagnant|regressed} → флаг. */
describe("detectStagnation", () => {
  it("пустая серия / одна точка → не застой", () => {
    expect(detectStagnation([])).toEqual({ stale: false, streak: 0 });
    expect(detectStagnation([100])).toEqual({ stale: false, streak: 0 });
  });

  it("n−1 застойных переходов (n точек) → НЕ флаг (порог не достигнут)", () => {
    // 3 точки = 2 перехода; n=3 недостижимо
    expect(detectStagnation([100, 100, 100], 3)).toEqual({
      stale: false,
      streak: 2,
    });
  });

  it("ровно n застойных переходов (n+1 точек) → флаг, streak=n", () => {
    // 4 точки = 3 перехода, все stagnant
    expect(detectStagnation([100, 100, 100, 100], 3)).toEqual({
      stale: true,
      streak: 3,
    });
  });

  it("regressed считается застоем (падение e1RM)", () => {
    expect(detectStagnation([100, 98, 96, 94], 3)).toEqual({
      stale: true,
      streak: 3,
    });
  });

  it("один improved в середине последних n сбрасывает хвост", () => {
    // переходы новейшие→старые: 100→100 stagnant, 95→100 improved (стоп)
    expect(detectStagnation([90, 95, 100, 100], 3)).toEqual({
      stale: false,
      streak: 1,
    });
  });

  it("новейший переход improved → streak 0 (растущее упражнение — без бейджа)", () => {
    expect(detectStagnation([100, 100, 100, 105], 3)).toEqual({
      stale: false,
      streak: 0,
    });
  });

  it("epsilon поглощает мелкий float-шум e1RM → застой", () => {
    // дельты 0.3 кг внутри epsilon=0.5 → каждый переход stagnant
    expect(detectStagnation([100, 100.3, 100.1, 100.4], 3, { epsilon: 0.5 })).toEqual(
      { stale: true, streak: 3 },
    );
  });

  it("длинный хвост застоя превышает n → streak реальный, stale=true", () => {
    expect(detectStagnation([100, 100, 100, 100, 100], 3)).toEqual({
      stale: true,
      streak: 4,
    });
  });
});
