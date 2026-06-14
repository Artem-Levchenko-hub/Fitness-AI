import { addDaysIso, isoWeekStartIso } from "@/lib/datetime/iso-week";

/** Один вклад в тоннаж группы: момент тренировки + уже role-folded объём
 *  (вес × повторы × фактор роли). Готовится repo (один запрос), бакетится
 *  здесь — чистая логика, тестируемая без БД. */
export type WeeklyVolumeContribution = {
  at: Date;
  volume: number;
};

/** Тоннаж группы по последним `weeks` ISO-неделям (oldest→newest) в TZ юзера,
 *  обрезанный по краям от пустых недель: ведущие и замыкающие недели без
 *  нагрузки убраны, внутренние нули (пропуск недели) сохранены — ряд читается
 *  как тренд активного отрезка. Нет нагрузки вовсе → [] (шаг панели пуст, R-37).
 *  Вклады вне окна (старше окна или в будущем по TZ-границе) игнорируются. */
export function weeklyVolumeSeries(
  contribs: WeeklyVolumeContribution[],
  now: Date,
  timeZone: string,
  weeks: number,
): number[] {
  if (weeks <= 0) return [];
  const currentWeekStart = isoWeekStartIso(now, timeZone);
  // Понедельники окна oldest→newest: [now-(weeks-1)нед … now].
  const weekIndex = new Map<string, number>();
  for (let i = 0; i < weeks; i++) {
    const start = addDaysIso(currentWeekStart, -7 * (weeks - 1 - i));
    weekIndex.set(start, i);
  }

  const series = new Array<number>(weeks).fill(0);
  for (const c of contribs) {
    const i = weekIndex.get(isoWeekStartIso(c.at, timeZone));
    if (i != null) series[i] += c.volume;
  }
  return trimZeroEdges(series);
}

/** Убирает ведущие и замыкающие нули, сохраняя внутренние. Полностью нулевой
 *  ряд → []. */
export function trimZeroEdges(series: number[]): number[] {
  let start = 0;
  let end = series.length;
  while (start < end && series[start] === 0) start++;
  while (end > start && series[end - 1] === 0) end--;
  return series.slice(start, end);
}
