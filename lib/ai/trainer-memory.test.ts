import { describe, expect, it } from "vitest";

import { extractPastAdvice, formatTrainerMemoryBlock } from "./trainer-memory";

/** Детерминированный форматтер даты для тестов (без локали ICU). */
const fmt = (d: Date) => d.toISOString().slice(0, 10);

/** Минимально-валидный TrainerResponse-объект для resultJson. */
function validResult(overrides: Record<string, unknown> = {}) {
  return {
    overallScore: 78,
    trainingQuality: { score: 80, comment: "ок" },
    recoveryContext: { score: null, comment: "—" },
    nutritionContext: { score: null, comment: "—" },
    exerciseComparisons: [],
    recommendations: ["Жим: +2.5 кг"],
    nextSessionFocus: "Жим: 85×5 RPE 8",
    missingDataAdvice: null,
    motivation: "держи темп",
    ...overrides,
  };
}

describe("extractPastAdvice", () => {
  it("достаёт nextSessionFocus и overallScore из валидного resultJson", () => {
    const createdAt = new Date("2026-06-09T10:00:00Z");
    const r = extractPastAdvice({ createdAt, resultJson: validResult() });
    expect(r.focus).toBe("Жим: 85×5 RPE 8");
    expect(r.score).toBe(78);
    expect(r.createdAt).toBe(createdAt);
  });

  it("legacy markdown-only (resultJson null) → focus null, score null", () => {
    const r = extractPastAdvice({
      createdAt: new Date("2026-06-01T00:00:00Z"),
      resultJson: null,
    });
    expect(r.focus).toBeNull();
    expect(r.score).toBeNull();
  });

  it("невалидный resultJson (не та схема) → focus null", () => {
    const r = extractPastAdvice({
      createdAt: new Date(),
      resultJson: { foo: "bar" },
    });
    expect(r.focus).toBeNull();
  });

  it("пустой/пробельный nextSessionFocus → focus null", () => {
    const r = extractPastAdvice({
      createdAt: new Date(),
      resultJson: validResult({ nextSessionFocus: "   " }),
    });
    expect(r.focus).toBeNull();
  });
});

describe("formatTrainerMemoryBlock", () => {
  it("пусто (нет валидных focus) → плейсхолдер «это первый»", () => {
    const out = formatTrainerMemoryBlock([], fmt);
    expect(out).toContain("это первый");
    expect(out).not.toContain("ты советовал");
  });

  it("legacy-строки без focus отфильтрованы → плейсхолдер", () => {
    const out = formatTrainerMemoryBlock(
      [{ createdAt: new Date("2026-06-01T00:00:00Z"), focus: null, score: null }],
      fmt,
    );
    expect(out).toContain("это первый");
  });

  it("сортирует по дате asc; последняя рекомендация — самая свежая", () => {
    const out = formatTrainerMemoryBlock(
      [
        { createdAt: new Date("2026-06-11T00:00:00Z"), focus: "Присед: 100×5", score: 80 },
        { createdAt: new Date("2026-06-09T00:00:00Z"), focus: "Жим: 85×5", score: 78 },
      ],
      fmt,
    );
    // Жим (старее) идёт раньше Приседа (свежее) в списке
    expect(out.indexOf("Жим: 85×5")).toBeLessThan(out.indexOf("Присед: 100×5"));
    // Инструкция указывает на ПОСЛЕДНЮЮ (свежую) рекомендацию
    const tail = out.slice(out.lastIndexOf("ОБЯЗАТЕЛЬНО"));
    expect(tail).toContain("Присед: 100×5");
    expect(tail).toContain("pastAdviceFollowUp");
  });

  it("показывает оценку, если есть; опускает, если null", () => {
    const out = formatTrainerMemoryBlock(
      [
        { createdAt: new Date("2026-06-09T00:00:00Z"), focus: "Жим: 85×5", score: 78 },
        { createdAt: new Date("2026-06-10T00:00:00Z"), focus: "Тяга: 120×5", score: null },
      ],
      fmt,
    );
    expect(out).toContain("оценка 78/100");
    // у строки без score нет «оценка …/100»
    const tyaga = out.split("\n").find((l) => l.includes("Тяга"));
    expect(tyaga).toBeDefined();
    expect(tyaga).not.toContain("оценка");
  });
});
