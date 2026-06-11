import { describe, expect, it } from "vitest";

import { addDaysIso, isoWeekStartIso } from "./iso-week";

describe("isoWeekStartIso", () => {
  it("понедельник → сам этот понедельник (МСК)", () => {
    // 2026-06-08 = понедельник
    expect(
      isoWeekStartIso(new Date("2026-06-08T12:00:00Z"), "Europe/Moscow"),
    ).toBe("2026-06-08");
  });

  it("воскресенье принадлежит неделе, начавшейся в прошлый понедельник (МСК)", () => {
    // 2026-06-14 = воскресенье → старт недели 2026-06-08
    expect(
      isoWeekStartIso(new Date("2026-06-14T12:00:00Z"), "Europe/Moscow"),
    ).toBe("2026-06-08");
  });

  it("середина недели → понедельник этой недели (МСК)", () => {
    // 2026-06-10 = среда
    expect(
      isoWeekStartIso(new Date("2026-06-10T12:00:00Z"), "Europe/Moscow"),
    ).toBe("2026-06-08");
  });

  it("БАГ-репро: один и тот же момент попадает в РАЗНЫЕ недели в разных TZ", () => {
    // 2026-06-08T05:00Z: МСК(+3)=Пн 08:00 8 июня → неделя 2026-06-08;
    //                    LA(-7)=Вс 22:00 7 июня → неделя 2026-06-01.
    const instant = new Date("2026-06-08T05:00:00Z");
    expect(isoWeekStartIso(instant, "Europe/Moscow")).toBe("2026-06-08");
    expect(isoWeekStartIso(instant, "America/Los_Angeles")).toBe("2026-06-01");
  });

  it("DST spring-forward (LA, вс 8 марта 2026) → корректный понедельник без off-by-one", () => {
    // 2026-03-08T20:00Z → LA(PDT,-7)=13:00 Вс 8 марта → неделя 2026-03-02
    expect(
      isoWeekStartIso(new Date("2026-03-08T20:00:00Z"), "America/Los_Angeles"),
    ).toBe("2026-03-02");
    // понедельник сразу после DST → своя неделя
    expect(
      isoWeekStartIso(new Date("2026-03-09T20:00:00Z"), "America/Los_Angeles"),
    ).toBe("2026-03-09");
  });

  it("кривая TZ → фолбэк на UTC-дату, не падает", () => {
    // 2026-06-10 среда (UTC) → понедельник 2026-06-08
    expect(
      isoWeekStartIso(new Date("2026-06-10T12:00:00Z"), "Not/AZone"),
    ).toBe("2026-06-08");
  });
});

describe("addDaysIso", () => {
  it("минус неделя", () => {
    expect(addDaysIso("2026-06-08", -7)).toBe("2026-06-01");
  });

  it("граница месяца назад", () => {
    expect(addDaysIso("2026-06-01", -1)).toBe("2026-05-31");
  });

  it("граница года назад", () => {
    expect(addDaysIso("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("вперёд", () => {
    expect(addDaysIso("2026-06-08", 7)).toBe("2026-06-15");
  });
});
