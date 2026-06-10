import { describe, expect, it } from "vitest";

import { bodyweightEffectiveLoad } from "./bodyweight-load";

describe("bodyweightEffectiveLoad", () => {
  it("вес тела + максимальная добавка по top-set", () => {
    const r = bodyweightEffectiveLoad(90, [
      { weightKg: 10 },
      { weightKg: 20 },
      { weightKg: 15 },
    ]);
    expect(r).toEqual({ effectiveKg: 110, addedKg: 20, pct: 18 });
  });

  it("чистый вес тела (добавка 0) → 0% добавки, реальная нагрузка = вес тела", () => {
    const r = bodyweightEffectiveLoad(90, [{ weightKg: 0 }]);
    expect(r).toEqual({ effectiveKg: 90, addedKg: 0, pct: 0 });
  });

  it("нет подходов → null", () => {
    expect(bodyweightEffectiveLoad(90, [])).toBeNull();
  });

  it("невалидный вес тела (0 / отрицательный / NaN) → null", () => {
    expect(bodyweightEffectiveLoad(0, [{ weightKg: 10 }])).toBeNull();
    expect(bodyweightEffectiveLoad(-5, [{ weightKg: 10 }])).toBeNull();
    expect(bodyweightEffectiveLoad(Number.NaN, [{ weightKg: 10 }])).toBeNull();
  });

  it("отрицательная добавка не уводит ниже веса тела (clamp 0)", () => {
    const r = bodyweightEffectiveLoad(90, [{ weightKg: -10 }]);
    expect(r).toEqual({ effectiveKg: 90, addedKg: 0, pct: 0 });
  });
});
