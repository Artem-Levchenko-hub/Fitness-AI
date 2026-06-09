/** ISO-дни недели (1=Пн .. 7=Вс) с короткими и полными русскими подписями.
 *  Общий источник для пикера расписания (клиент) и списка (сервер). */
export const WEEKDAYS: ReadonlyArray<{
  iso: number;
  short: string;
  full: string;
}> = [
  { iso: 1, short: "Пн", full: "Понедельник" },
  { iso: 2, short: "Вт", full: "Вторник" },
  { iso: 3, short: "Ср", full: "Среда" },
  { iso: 4, short: "Чт", full: "Четверг" },
  { iso: 5, short: "Пт", full: "Пятница" },
  { iso: 6, short: "Сб", full: "Суббота" },
  { iso: 7, short: "Вс", full: "Воскресенье" },
];

/** «Пн · Ср · Пт» из отсортированного массива ISO-дней. */
export function formatDays(days: number[]): string {
  const map = new Map(WEEKDAYS.map((d) => [d.iso, d.short]));
  return days
    .map((d) => map.get(d))
    .filter(Boolean)
    .join(" · ");
}

/** «18:00» из часа. */
export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}
