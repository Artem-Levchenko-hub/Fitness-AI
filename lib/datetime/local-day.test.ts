import { describe, expect, it } from "vitest";

import { localDateIso, localIsoDay } from "./local-day";

describe("localIsoDay", () => {
  it("Пн → 1 (UTC-полдень, тот же день)", () => {
    // 2026-06-08 = понедельник
    expect(localIsoDay(new Date("2026-06-08T12:00:00Z"), "Europe/Moscow")).toBe(
      1,
    );
  });

  it("Вс → 7 (а не 0)", () => {
    // 2026-06-14 = воскресенье
    expect(localIsoDay(new Date("2026-06-14T12:00:00Z"), "Europe/Moscow")).toBe(
      7,
    );
  });

  it("TZ сдвигает дату через полночь: 23:30 UTC пн в МСК = уже вторник", () => {
    // 2026-06-08T23:30Z → МСК (+3) = 2026-06-09 02:30 = вторник
    expect(localIsoDay(new Date("2026-06-08T23:30:00Z"), "Europe/Moscow")).toBe(
      2,
    );
  });

  it("негативный сдвиг: 01:00 UTC вт в Лос-Анджелесе = ещё понедельник", () => {
    // 2026-06-09T01:00Z → LA (-7) = 2026-06-08 18:00 = понедельник
    expect(
      localIsoDay(new Date("2026-06-09T01:00:00Z"), "America/Los_Angeles"),
    ).toBe(1);
  });

  it("кривая TZ → фолбэк на UTC-дату, не падает", () => {
    expect(
      localIsoDay(new Date("2026-06-08T12:00:00Z"), "Not/AZone"),
    ).toBe(1);
  });
});

describe("localDateIso", () => {
  it("форматирует YYYY-MM-DD в локальной TZ", () => {
    expect(localDateIso(new Date("2026-06-08T23:30:00Z"), "Europe/Moscow")).toBe(
      "2026-06-09",
    );
  });

  it("кривая TZ → UTC-дата", () => {
    expect(localDateIso(new Date("2026-06-08T23:30:00Z"), "Not/AZone")).toBe(
      "2026-06-08",
    );
  });
});
