import { describe, expect, it } from "vitest";

import { buildCardioTemplatePreset } from "./cardio-template-preset";

describe("buildCardioTemplatePreset", () => {
  it("тримит имя", () => {
    const p = buildCardioTemplatePreset({
      name: "  Утреннее HIIT  ",
      preset: "tabata",
    });
    expect(p.name).toBe("Утреннее HIIT");
  });

  it("пустое/пробельное имя — ошибка (шаблон не переиспользуем)", () => {
    expect(() =>
      buildCardioTemplatePreset({ name: "   ", preset: "custom" }),
    ).toThrow();
  });

  it("custom — оставляет rounds/workSec/restSec, отбрасывает emomRounds", () => {
    const p = buildCardioTemplatePreset({
      name: "Свой",
      preset: "custom",
      rounds: 6,
      workSec: 30,
      restSec: 60,
      emomRounds: 99,
    });
    expect(p.preset).toBe("custom");
    expect(p.params).toEqual({ rounds: 6, workSec: 30, restSec: 60 });
  });

  it("emom — оставляет только emomRounds, отбрасывает custom-поля", () => {
    const p = buildCardioTemplatePreset({
      name: "EMOM",
      preset: "emom",
      emomRounds: 12,
      rounds: 5,
      workSec: 40,
    });
    expect(p.params).toEqual({ emomRounds: 12 });
  });

  it("tabata — фиксированный, params пустой", () => {
    const p = buildCardioTemplatePreset({
      name: "Tabata",
      preset: "tabata",
      rounds: 8,
      emomRounds: 10,
    });
    expect(p.params).toEqual({});
  });

  it("norwegian_4x4 — фиксированный, params пустой", () => {
    const p = buildCardioTemplatePreset({
      name: "Норвежский 4×4",
      preset: "norwegian_4x4",
      restSec: 180,
    });
    expect(p.params).toEqual({});
  });

  it("custom с null-полями — опускает их (не пишет undefined-мусор)", () => {
    const p = buildCardioTemplatePreset({
      name: "Частичный",
      preset: "custom",
      rounds: 4,
      workSec: null,
      restSec: null,
    });
    expect(p.params).toEqual({ rounds: 4 });
  });
});
