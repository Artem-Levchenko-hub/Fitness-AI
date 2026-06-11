import { describe, it, expect } from "vitest";

import { WEEKDAYS, formatDays, formatHour } from "./weekdays";

/** Характеризационное покрытие общего источника подписей дней недели для
 *  пикера расписания (клиент) и списка «сегодня» (сервер) — G7a. Фиксирует
 *  контракт display-хелперов, чтобы рефактор не сломал отображение
 *  расписания владельцу (неверный день/время = пропущенная тренировка). */
describe("WEEKDAYS", () => {
  it("ровно 7 дней в ISO-порядке Пн..Вс (единый источник для пикера и списка)", () => {
    expect(WEEKDAYS).toHaveLength(7);
    expect(WEEKDAYS.map((d) => d.iso)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(WEEKDAYS.map((d) => d.short)).toEqual([
      "Пн",
      "Вт",
      "Ср",
      "Чт",
      "Пт",
      "Сб",
      "Вс",
    ]);
    expect(WEEKDAYS[0].full).toBe("Понедельник");
    expect(WEEKDAYS[6].full).toBe("Воскресенье");
  });
});

describe("formatDays", () => {
  it("вся неделя [1..7] → подписи через ' · '", () => {
    expect(formatDays([1, 2, 3, 4, 5, 6, 7])).toBe(
      "Пн · Вт · Ср · Чт · Пт · Сб · Вс",
    );
  });

  it("типичный набор [1,3,5] → 'Пн · Ср · Пт'", () => {
    expect(formatDays([1, 3, 5])).toBe("Пн · Ср · Пт");
  });

  it("один день → без разделителя", () => {
    expect(formatDays([6])).toBe("Сб");
  });

  it("пустой массив → пустая строка", () => {
    expect(formatDays([])).toBe("");
  });

  it("неизвестные ISO молча отбрасываются (0/8/-1 → drop), валидные остаются", () => {
    expect(formatDays([0, 8, -1, 3])).toBe("Ср");
  });

  it("все неизвестные → пустая строка", () => {
    expect(formatDays([0, 8])).toBe("");
  });

  it("НЕ сортирует — сохраняет порядок ввода (контракт: caller сортирует сам)", () => {
    expect(formatDays([5, 1, 3])).toBe("Пт · Пн · Ср");
  });
});

describe("formatHour", () => {
  it("полночь 0 → '00:00' (zero-pad)", () => {
    expect(formatHour(0)).toBe("00:00");
  });

  it("одноразрядный час 9 → '09:00'", () => {
    expect(formatHour(9)).toBe("09:00");
  });

  it("двухразрядный час 18 → '18:00'", () => {
    expect(formatHour(18)).toBe("18:00");
  });

  it("конец суток 23 → '23:00'", () => {
    expect(formatHour(23)).toBe("23:00");
  });
});
