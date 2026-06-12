import { describe, expect, it } from "vitest";

import { FORGOTTEN_WEEKS, forgottenLabel, forgottenWeeks } from "./forgotten";

// «Забытые мышцы» (H6.4): полные недели без нагрузки от ВСЕВРЕМЕННОЙ последней
// тренировки группы. Порог FORGOTTEN_WEEKS=2; ниже порога и «никогда» → null
// (бейдж «N недель» не утверждается).

const NOW = new Date("2026-06-12T12:00:00Z");
const daysAgo = (d: number) =>
  new Date(NOW.getTime() - d * 86_400_000);

describe("forgottenWeeks", () => {
  it("никогда не тренировалась (null) → null", () => {
    expect(forgottenWeeks(null, NOW)).toBeNull();
  });

  it("тренировалась сегодня → 0 недель → null", () => {
    expect(forgottenWeeks(NOW, NOW)).toBeNull();
  });

  it("13 дней назад → 1 неделя, ниже порога → null", () => {
    expect(forgottenWeeks(daysAgo(13), NOW)).toBeNull();
  });

  it("ровно 14 дней назад → 2 недели → 2 (порог)", () => {
    expect(forgottenWeeks(daysAgo(14), NOW)).toBe(FORGOTTEN_WEEKS);
  });

  it("20 дней назад → всё ещё 2 полные недели → 2", () => {
    expect(forgottenWeeks(daysAgo(20), NOW)).toBe(2);
  });

  it("21 день назад → 3 недели → 3", () => {
    expect(forgottenWeeks(daysAgo(21), NOW)).toBe(3);
  });

  it("дата в будущем (мусор) → null", () => {
    expect(forgottenWeeks(daysAgo(-3), NOW)).toBeNull();
  });
});

describe("forgottenLabel", () => {
  it("2 → «2 недели без нагрузки»", () => {
    expect(forgottenLabel(2)).toBe("2 недели без нагрузки");
  });

  it("5 → «5 недель без нагрузки»", () => {
    expect(forgottenLabel(5)).toBe("5 недель без нагрузки");
  });

  it("3 → «3 недели без нагрузки»", () => {
    expect(forgottenLabel(3)).toBe("3 недели без нагрузки");
  });

  it("21 → «21 неделя без нагрузки» (mod10==1)", () => {
    expect(forgottenLabel(21)).toBe("21 неделя без нагрузки");
  });

  it("11 → «11 недель без нагрузки» (mod100==11 исключение)", () => {
    expect(forgottenLabel(11)).toBe("11 недель без нагрузки");
  });
});
