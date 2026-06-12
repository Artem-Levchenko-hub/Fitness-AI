import { addDaysIso } from "@/lib/datetime/iso-week";

/** Превью «эта неделя» для дашборд-тайла /stats (H4.1): 7 точек-дней
 *  тренировался/нет + тоннаж недели + дельта к прошлой неделе. Чистый домен
 *  (R-7) — НЕ тянет полный Recharts на первый экран: тяжёлый график живёт в
 *  /stats, тут лишь компактный снимок тех же данных.
 *
 *  Совпадение со /stats — конструктивное: `volume` берётся из того же
 *  working/completed источника, что `weeklyVolume` (ISO-понедельник —
 *  date_trunc('week') == isoWeekStartIso), а дни — из того же `workoutFrequency`,
 *  что рисует FrequencyHeatmap. */

/** Точка дневного объёма (минимальный контракт; repo маппит DailyVolumePoint). */
export type DayVolume = {
  /** YYYY-MM-DD в timezone юзера. */
  date: string;
  /** Working-тоннаж за день (кг·повт). */
  volume: number;
};

/** Точка частоты (минимальный контракт; repo маппит FrequencyPoint). */
export type DayFrequency = {
  /** YYYY-MM-DD в timezone юзера. */
  date: string;
  /** Число завершённых тренировок в этот день. */
  count: number;
};

export type WeekStrip = {
  /** Working-тоннаж текущей ISO-недели (кг·повт). */
  tonnage: number;
  /** Working-тоннаж прошлой ISO-недели той же длины. */
  prevTonnage: number;
  /** Изменение к прошлой неделе в процентах (округлено). null — если прошлая
   *  неделя пуста (нет базы → не показываем «+∞%», не NaN). */
  deltaPct: number | null;
  /** 7 флагов Пн..Вс текущей недели: тренировался ли в этот день. */
  days: boolean[];
};

/** Сворачивает дневной объём + частоту в тайл-превью текущей недели.
 *  `weekStartIso` — понедельник текущей ISO-недели (YYYY-MM-DD) в TZ юзера. */
export function buildWeekStrip(
  daily: DayVolume[],
  frequency: DayFrequency[],
  weekStartIso: string,
): WeekStrip {
  const prevWeekStartIso = addDaysIso(weekStartIso, -7);
  const weekEndIso = addDaysIso(weekStartIso, 7); // эксклюзивно

  let tonnage = 0;
  let prevTonnage = 0;
  for (const d of daily) {
    if (d.date >= weekStartIso && d.date < weekEndIso) tonnage += d.volume;
    else if (d.date >= prevWeekStartIso && d.date < weekStartIso) {
      prevTonnage += d.volume;
    }
  }

  const trained = new Set(
    frequency.filter((f) => f.count > 0).map((f) => f.date),
  );
  const days = Array.from({ length: 7 }, (_, i) =>
    trained.has(addDaysIso(weekStartIso, i)),
  );

  const deltaPct =
    prevTonnage > 0
      ? Math.round(((tonnage - prevTonnage) / prevTonnage) * 100)
      : null;

  return { tonnage, prevTonnage, deltaPct, days };
}
