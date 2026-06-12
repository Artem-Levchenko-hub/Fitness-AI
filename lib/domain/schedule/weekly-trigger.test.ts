import { describe, expect, it } from "vitest";

import {
  MIN_WEEKLY_SESSIONS,
  WEEKLY_REVIEW_HOUR,
  isWeeklyReviewWindow,
} from "./weekly-trigger";

// 2026-06-14 — это ВОСКРЕСЕНЬЕ. Москва = UTC+3.
// 17:00 UTC = 20:00 Мск Вс → попадание в окно.
const SUN_2000_MSK = new Date("2026-06-14T17:00:00Z");

describe("isWeeklyReviewWindow", () => {
  it("воскресенье 20:00 в таймзоне атлета → true", () => {
    expect(isWeeklyReviewWindow(SUN_2000_MSK, "Europe/Moscow")).toBe(true);
  });

  it("воскресенье, но не 20:00 локально → false", () => {
    // 16:00 UTC = 19:00 Мск Вс
    expect(
      isWeeklyReviewWindow(new Date("2026-06-14T16:00:00Z"), "Europe/Moscow"),
    ).toBe(false);
  });

  it("20:00, но не воскресенье → false", () => {
    // 2026-06-15 = понедельник. 17:00 UTC = 20:00 Мск Пн
    expect(
      isWeeklyReviewWindow(new Date("2026-06-15T17:00:00Z"), "Europe/Moscow"),
    ).toBe(false);
  });

  it("то же мгновение, но в другой таймзоне выпадает из окна", () => {
    // 17:00 UTC = 13:00 Нью-Йорк (UTC-4 летом) Вс → не 20:00
    expect(isWeeklyReviewWindow(SUN_2000_MSK, "America/New_York")).toBe(false);
  });

  it("другая tz, где это мгновение = Вс 20:00 локально → true", () => {
    // 17:00 UTC: ищем tz UTC+3 без DST-сюрпризов — Europe/Moscow уже покрыт;
    // проверим, что окно действительно tz-зависимо: 00:00 UTC Пн =
    // Вс 20:00 в America/New_York (UTC-4).
    expect(
      isWeeklyReviewWindow(
        new Date("2026-06-15T00:00:00Z"),
        "America/New_York",
      ),
    ).toBe(true);
  });

  it("невалидная таймзона → false (fail-soft)", () => {
    expect(isWeeklyReviewWindow(SUN_2000_MSK, "Not/AZone")).toBe(false);
  });

  it("константы окна имеют ожидаемые значения", () => {
    expect(WEEKLY_REVIEW_HOUR).toBe(20);
    expect(MIN_WEEKLY_SESSIONS).toBe(2);
  });
});
