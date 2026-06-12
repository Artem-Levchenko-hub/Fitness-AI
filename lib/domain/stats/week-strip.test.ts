import { describe, expect, it } from "vitest";

import { buildWeekStrip, type DayVolume, type DayFrequency } from "./week-strip";

const WEEK = "2026-06-08"; // понедельник
// Прошлая неделя: 2026-06-01 .. 2026-06-07; текущая: 2026-06-08 .. 2026-06-14.

describe("buildWeekStrip", () => {
  it("суммирует тоннаж текущей и прошлой недели по границам ISO-понедельника", () => {
    const daily: DayVolume[] = [
      { date: "2026-06-07", volume: 1000 }, // вс прошлой недели → prev
      { date: "2026-06-08", volume: 500 }, // пн текущей → current
      { date: "2026-06-11", volume: 700 }, // чт текущей → current
      { date: "2026-06-14", volume: 300 }, // вс текущей → current (граница вкл)
      { date: "2026-06-15", volume: 999 }, // пн след. недели → ни туда, ни сюда
      { date: "2026-06-01", volume: 200 }, // пн прошлой → prev
    ];
    const strip = buildWeekStrip(daily, [], WEEK);
    expect(strip.tonnage).toBe(1500); // 500+700+300
    expect(strip.prevTonnage).toBe(1200); // 1000+200
  });

  it("дельта = округлённый процент роста к прошлой неделе", () => {
    const daily: DayVolume[] = [
      { date: "2026-06-08", volume: 1500 },
      { date: "2026-06-01", volume: 1000 },
    ];
    const strip = buildWeekStrip(daily, [], WEEK);
    expect(strip.deltaPct).toBe(50);
  });

  it("дельта отрицательна при просадке", () => {
    const daily: DayVolume[] = [
      { date: "2026-06-08", volume: 800 },
      { date: "2026-06-01", volume: 1000 },
    ];
    const strip = buildWeekStrip(daily, [], WEEK);
    expect(strip.deltaPct).toBe(-20);
  });

  it("прошлая неделя пуста → deltaPct null (не +∞%, не NaN)", () => {
    const daily: DayVolume[] = [{ date: "2026-06-08", volume: 1200 }];
    const strip = buildWeekStrip(daily, [], WEEK);
    expect(strip.tonnage).toBe(1200);
    expect(strip.prevTonnage).toBe(0);
    expect(strip.deltaPct).toBeNull();
  });

  it("пустые данные → нули, deltaPct null, все дни false", () => {
    const strip = buildWeekStrip([], [], WEEK);
    expect(strip.tonnage).toBe(0);
    expect(strip.prevTonnage).toBe(0);
    expect(strip.deltaPct).toBeNull();
    expect(strip.days).toEqual([false, false, false, false, false, false, false]);
  });

  it("дни Пн..Вс отмечаются по частоте текущей недели (count>0)", () => {
    const frequency: DayFrequency[] = [
      { date: "2026-06-08", count: 1 }, // пн
      { date: "2026-06-11", count: 2 }, // чт
      { date: "2026-06-14", count: 1 }, // вс
      { date: "2026-06-07", count: 1 }, // вс прошлой → НЕ в текущей полосе
      { date: "2026-06-15", count: 5 }, // пн след. → НЕ в полосе
    ];
    const strip = buildWeekStrip([], frequency, WEEK);
    expect(strip.days).toEqual([true, false, false, true, false, false, true]);
  });

  it("count=0 не считается тренировочным днём", () => {
    const frequency: DayFrequency[] = [{ date: "2026-06-08", count: 0 }];
    const strip = buildWeekStrip([], frequency, WEEK);
    expect(strip.days[0]).toBe(false);
  });
});
