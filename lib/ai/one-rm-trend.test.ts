import { describe, expect, it } from "vitest";

import { formatOneRmTrend } from "./one-rm-trend";

/** Характеризационное покрытие owner-facing рендера тренда e1RM для AI-контекста.
 *  Фиксирует: ветку «нет прошлых данных», знак дельты, формат toFixed(1),
 *  и G5-флаг подозрительного скачка (пороги ≥10 кг И ≥20%, округление %). */
describe("formatOneRmTrend", () => {
  it("previousKg null → ветка «нет прошлых данных» с e1RM сегодня", () => {
    expect(
      formatOneRmTrend({ nameRu: "Жим", todayKg: 50, previousKg: null }),
    ).toBe("- **Жим**: сегодня e1RM 50.0 kg (нет прошлых данных)");
  });

  it("previousKg 0 трактуется как отсутствие базы (та же ветка)", () => {
    expect(
      formatOneRmTrend({ nameRu: "Жим", todayKg: 50, previousKg: 0 }),
    ).toBe("- **Жим**: сегодня e1RM 50.0 kg (нет прошлых данных)");
  });

  it("обычный рост: знак «+», обе величины toFixed(1)", () => {
    expect(
      formatOneRmTrend({ nameRu: "Присед", todayKg: 102, previousKg: 100 }),
    ).toBe("- **Присед**: 100.0 → 102.0 kg (+2.0)");
  });

  it("регресс: дельта отрицательная, без знака «+»", () => {
    expect(
      formatOneRmTrend({ nameRu: "Тяга", todayKg: 95, previousKg: 100 }),
    ).toBe("- **Тяга**: 100.0 → 95.0 kg (-5.0)");
  });

  it("дельта ровно 0 → знак «+» (delta >= 0)", () => {
    expect(
      formatOneRmTrend({ nameRu: "Жим", todayKg: 100, previousKg: 100 }),
    ).toBe("- **Жим**: 100.0 → 100.0 kg (+0.0)");
  });

  it("дробные значения форматируются toFixed(1)", () => {
    expect(
      formatOneRmTrend({ nameRu: "Жим", todayKg: 102.04, previousKg: 100.26 }),
    ).toBe("- **Жим**: 100.3 → 102.0 kg (+1.8)");
  });

  it("подозрительный скачок (≥10 кг И ≥20%): базовая строка + G5-предупреждение", () => {
    const out = formatOneRmTrend({
      nameRu: "Жим",
      todayKg: 130,
      previousKg: 100,
    });
    expect(out).toContain("- **Жим**: 100.0 → 130.0 kg (+30.0)");
    expect(out).toContain("⚠️ ПОДОЗРИТЕЛЬНЫЙ СКАЧОК (+30% за сессию)");
    expect(out).toContain("НЕ считать рекордом");
  });

  it("границы скачка — ровно +10 кг и ровно +20% флагуется", () => {
    const out = formatOneRmTrend({ nameRu: "Жим", todayKg: 60, previousKg: 50 });
    expect(out).toContain("⚠️ ПОДОЗРИТЕЛЬНЫЙ СКАЧОК (+20% за сессию)");
  });

  it("большой % но малая абс. дельта (<10 кг) НЕ флагуется", () => {
    const out = formatOneRmTrend({ nameRu: "Бицепс", todayKg: 8, previousKg: 5 });
    expect(out).toBe("- **Бицепс**: 5.0 → 8.0 kg (+3.0)");
    expect(out).not.toContain("⚠️");
  });

  it("большая абс. дельта (≥10 кг) но малый % (<20%) НЕ флагуется", () => {
    const out = formatOneRmTrend({
      nameRu: "Присед",
      todayKg: 110,
      previousKg: 100,
    });
    expect(out).toBe("- **Присед**: 100.0 → 110.0 kg (+10.0)");
    expect(out).not.toContain("⚠️");
  });

  it("процент скачка округляется Math.round", () => {
    const out = formatOneRmTrend({
      nameRu: "Жим",
      todayKg: 137.5,
      previousKg: 100,
    });
    // pct = 0.375 → round(37.5) = 38
    expect(out).toContain("(+38% за сессию)");
    expect(out).toContain("- **Жим**: 100.0 → 137.5 kg (+37.5)");
  });
});
