import { describe, expect, it } from "vitest";

import { TREND_LABEL, trendStatus } from "./trend";

describe("trendStatus — базовая семантика (higherIsBetter по умолчанию)", () => {
  it("нет истории → new", () => {
    expect(trendStatus(null, 100)).toBe("new");
    expect(trendStatus(undefined, 100)).toBe("new");
  });
  it("рост → improved", () => {
    expect(trendStatus(100, 110)).toBe("improved");
  });
  it("падение → regressed", () => {
    expect(trendStatus(110, 100)).toBe("regressed");
  });
  it("без изменения → stagnant", () => {
    expect(trendStatus(100, 100)).toBe("stagnant");
  });
  it("ноль как валидное prev (не путать с null)", () => {
    expect(trendStatus(0, 5)).toBe("improved");
    expect(trendStatus(0, 0)).toBe("stagnant");
  });
});

describe("trendStatus — epsilon (зона нечувствительности)", () => {
  it("изменение внутри epsilon → stagnant", () => {
    expect(trendStatus(100, 100.4, { epsilon: 0.5 })).toBe("stagnant");
    expect(trendStatus(100, 99.6, { epsilon: 0.5 })).toBe("stagnant");
  });
  it("изменение ровно на epsilon → stagnant (граница включительно)", () => {
    expect(trendStatus(100, 100.5, { epsilon: 0.5 })).toBe("stagnant");
  });
  it("изменение за пределами epsilon → тренд", () => {
    expect(trendStatus(100, 101, { epsilon: 0.5 })).toBe("improved");
    expect(trendStatus(100, 99, { epsilon: 0.5 })).toBe("regressed");
  });
});

describe("trendStatus — higherIsBetter=false (метрика, где рост ≠ прогресс)", () => {
  it("рост значения → regressed", () => {
    expect(trendStatus(80, 85, { higherIsBetter: false })).toBe("regressed");
  });
  it("падение значения → improved", () => {
    expect(trendStatus(85, 80, { higherIsBetter: false })).toBe("improved");
  });
  it("без изменения → stagnant", () => {
    expect(trendStatus(80, 80, { higherIsBetter: false })).toBe("stagnant");
  });
});

describe("TREND_LABEL", () => {
  it("есть подпись для каждого статуса", () => {
    expect(TREND_LABEL.improved).toBe("Рост");
    expect(TREND_LABEL.regressed).toBe("Регресс");
    expect(TREND_LABEL.stagnant).toBe("Стагнация");
    expect(TREND_LABEL.new).toBe("Новое");
  });
});
