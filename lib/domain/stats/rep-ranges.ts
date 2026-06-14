/** Диапазоны повторений: power (1-5) / hypertrophy (6-10, 11-15) / endurance
 *  (16+). Распределение подходов по ним — power/hypertrophy/endurance split. */
export type RepRangeBucket = "1-5" | "6-10" | "11-15" | "16+";

export type RepRangePoint = {
  bucket: RepRangeBucket;
  sets: number;
};

/** Раскладывает список повторений выполненных подходов (силовые working +
 *  круговые невыполненные-пропуск раунды с повторами) по диапазонам. Чистая
 *  логика (R-7) — node-юнит-тест; всегда возвращает 4 бакета в фикс-порядке
 *  (нулевые включительно). Круговые reps-раунды теперь учитываются; duration-
 *  раунды (без повторов) на вход не подаются. */
export function distributeRepRanges(repsList: number[]): RepRangePoint[] {
  const buckets: Record<RepRangeBucket, number> = {
    "1-5": 0,
    "6-10": 0,
    "11-15": 0,
    "16+": 0,
  };
  for (const reps of repsList) {
    if (reps <= 5) buckets["1-5"] += 1;
    else if (reps <= 10) buckets["6-10"] += 1;
    else if (reps <= 15) buckets["11-15"] += 1;
    else buckets["16+"] += 1;
  }
  return [
    { bucket: "1-5", sets: buckets["1-5"] },
    { bucket: "6-10", sets: buckets["6-10"] },
    { bucket: "11-15", sets: buckets["11-15"] },
    { bucket: "16+", sets: buckets["16+"] },
  ];
}
