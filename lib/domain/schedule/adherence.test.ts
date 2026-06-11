import { describe, expect, it } from "vitest";

import { computeScheduleAdherence } from "./adherence";

// Якорь: «сегодня» = Пт 2026-06-12 (локально). Прошлое окно — 7 дней назад
// (offsets 1..7, исключая сегодня), будущее — сегодня..+6.
const PAST_DAYS = [
  { date: "2026-06-11", isoDay: 4 },
  { date: "2026-06-10", isoDay: 3 },
  { date: "2026-06-09", isoDay: 2 },
  { date: "2026-06-08", isoDay: 1 },
  { date: "2026-06-07", isoDay: 7 },
  { date: "2026-06-06", isoDay: 6 },
  { date: "2026-06-05", isoDay: 5 },
];
const UPCOMING_DAYS = [
  { date: "2026-06-12", isoDay: 5 },
  { date: "2026-06-13", isoDay: 6 },
  { date: "2026-06-14", isoDay: 7 },
  { date: "2026-06-15", isoDay: 1 },
  { date: "2026-06-16", isoDay: 2 },
  { date: "2026-06-17", isoDay: 3 },
  { date: "2026-06-18", isoDay: 4 },
];

// Расписание «Ноги»: Пн·Ср·Пт (ISO 1,3,5) в 18:00.
const LEGS = { label: "Ноги", daysOfWeek: [1, 3, 5], hour: 18 };

describe("computeScheduleAdherence", () => {
  it("нет расписаний → всё пусто, не падает", () => {
    const a = computeScheduleAdherence([], PAST_DAYS, UPCOMING_DAYS, new Set());
    expect(a.planned7d).toBe(0);
    expect(a.done7d).toBe(0);
    expect(a.missed).toEqual([]);
    expect(a.upcoming).toEqual([]);
  });

  it("план vs факт за 7 дней: 3 запланировано, 2 выполнено, 1 пропуск", () => {
    const completed = new Set(["2026-06-10", "2026-06-08"]);
    const a = computeScheduleAdherence([LEGS], PAST_DAYS, UPCOMING_DAYS, completed);
    // Прошлые дни с днём-недели ∈ {1,3,5}: 06-10(Ср), 06-08(Пн), 06-05(Пт).
    expect(a.planned7d).toBe(3);
    // Из них завершены 06-10 и 06-08.
    expect(a.done7d).toBe(2);
    expect(a.missed).toEqual([
      { date: "2026-06-05", isoDay: 5, labels: ["Ноги"] },
    ]);
  });

  it("ближайшие 7 дней: только дни, где есть запланированная сессия", () => {
    const a = computeScheduleAdherence([LEGS], PAST_DAYS, UPCOMING_DAYS, new Set());
    expect(a.upcoming).toEqual([
      { date: "2026-06-12", isoDay: 5, label: "Ноги", hour: 18 },
      { date: "2026-06-15", isoDay: 1, label: "Ноги", hour: 18 },
      { date: "2026-06-17", isoDay: 3, label: "Ноги", hour: 18 },
    ]);
  });

  it("несколько расписаний в один день → пропуск перечисляет оба лейбла", () => {
    const back = { label: "Спина", daysOfWeek: [5], hour: 19 };
    const a = computeScheduleAdherence(
      [LEGS, back],
      PAST_DAYS,
      UPCOMING_DAYS,
      new Set(["2026-06-10", "2026-06-08"]),
    );
    // 06-05 (Пт) запланировано обоими, не выполнено.
    expect(a.missed).toEqual([
      { date: "2026-06-05", isoDay: 5, labels: ["Ноги", "Спина"] },
    ]);
    // День Пт считается как ОДИН запланированный день (day-granular), не два.
    expect(a.planned7d).toBe(3);
  });

  it("пустой daysOfWeek никогда не срабатывает", () => {
    const dead = { label: "Никогда", daysOfWeek: [], hour: 10 };
    const a = computeScheduleAdherence([dead], PAST_DAYS, UPCOMING_DAYS, new Set());
    expect(a.planned7d).toBe(0);
    expect(a.upcoming).toEqual([]);
  });
});
