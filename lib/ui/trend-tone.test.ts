import { describe, expect, it } from "vitest";

import type { TrendStatus } from "@/lib/domain/progression/trend";

import { TREND_TONE } from "./trend-tone";

/** Характеризационное покрытие презентационного маппинга тренда. Цель — НЕ
 *  зеркалить константы, а зафиксировать инварианты, которые TypeScript НЕ
 *  ловит в рантайме: семантику цвета (рост=зелёный, регресс=красный),
 *  визуальную различимость статусов (иначе на графике не отличить рост от
 *  регресса) и R-41 (не только цветом — у каждого статуса свой глиф).
 *  Один источник правды для F4 (TrainerResultCard) и F7 (графики /stats). */

const STATUSES: TrendStatus[] = ["improved", "regressed", "stagnant", "new"];

describe("TREND_TONE", () => {
  it("покрывает РОВНО 4 статуса тренда без лишних/недостающих", () => {
    expect(Object.keys(TREND_TONE).sort()).toEqual(
      [...STATUSES].sort(),
    );
  });

  it("у каждого статуса заполнены все 4 поля непустыми строками", () => {
    for (const status of STATUSES) {
      const tone = TREND_TONE[status];
      expect(tone.text.length).toBeGreaterThan(0);
      expect(tone.bg.length).toBeGreaterThan(0);
      expect(tone.icon.length).toBeGreaterThan(0);
      expect(tone.stroke.length).toBeGreaterThan(0);
    }
  });

  // Семантика: рост видится зелёным, регресс — красным. TS разрешает любую
  // строку → случайный своп improved↔regressed дал бы КРАСНЫЙ за прогресс.
  it("рост (improved) завязан на success-токен и стрелку вверх", () => {
    const tone = TREND_TONE.improved;
    expect(tone.text).toContain("success");
    expect(tone.bg).toContain("success");
    expect(tone.stroke).toContain("success");
    expect(tone.icon).toBe("↑");
  });

  it("регресс (regressed) завязан на destructive-токен и стрелку вниз", () => {
    const tone = TREND_TONE.regressed;
    expect(tone.text).toContain("destructive");
    expect(tone.bg).toContain("destructive");
    expect(tone.stroke).toContain("destructive");
    expect(tone.icon).toBe("↓");
  });

  it("стагнация (stagnant) — нейтральный muted-токен и знак равенства", () => {
    const tone = TREND_TONE.stagnant;
    expect(tone.text).toContain("muted");
    expect(tone.stroke).toContain("muted");
    expect(tone.icon).toBe("=");
  });

  it("новое (new) — primary-акцент для stroke и точка-маркер", () => {
    const tone = TREND_TONE.new;
    expect(tone.stroke).toContain("primary");
    expect(tone.icon).toBe("•");
  });

  // Различимость: если рост и регресс одного цвета — на графике их не отличить.
  it("у всех статусов РАЗНЫЙ stroke (рост/регресс/стагнация различимы)", () => {
    const strokes = STATUSES.map((s) => TREND_TONE[s].stroke);
    expect(new Set(strokes).size).toBe(STATUSES.length);
  });

  // R-41: статус нельзя кодировать только цветом → у каждого свой глиф.
  it("у всех статусов РАЗНЫЙ icon-глиф (R-41: не только цветом)", () => {
    const icons = STATUSES.map((s) => TREND_TONE[s].icon);
    expect(new Set(icons).size).toBe(STATUSES.length);
  });

  // R-36: Recharts не принимает Tailwind-класс — stroke обязан быть реальным
  // CSS-токеном var(--…), иначе линии/бары графика молча станут чёрными.
  it("stroke у всех — CSS-переменная var(--token), не Tailwind-класс", () => {
    for (const status of STATUSES) {
      expect(TREND_TONE[status].stroke).toMatch(/^var\(--[a-z-]+\)$/);
    }
  });
});
