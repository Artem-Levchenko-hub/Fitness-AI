import type { HeatLevel } from "./heat";

/** Группировка нагрева аватара в три человекочитаемых корзины для легенды-чипов
 *  под моделью. Производное от доменного `HeatLevel` (heat.ts) — НЕ пересчёт
 *  подходов (R-04): корзина = свёртка пяти уровней нагрева в три. Чистый модуль
 *  (R-7): нет импортов из db/ui/three. Единственный источник правды о том, как
 *  нагрев раскладывается по чипам. */

export type HeatBucket = "overload" | "working" | "cold";

/** Корзина нагрева из уровня:
 *  - peak (≥SETS_PEAK подходов/нед) → overload «перегруз»;
 *  - dormant (0 подходов) → cold «недогрет»;
 *  - low | normal | high (1..SETS_PEAK−1) → working «в работе». */
export function heatBucket(level: HeatLevel): HeatBucket {
  if (level === "peak") return "overload";
  if (level === "dormant") return "cold";
  return "working";
}

/** Порядок корзин в легенде: сперва перегруженные (требуют внимания), затем в
 *  работе, затем холодные (недогруз — тоже сигнал). */
export const HEAT_BUCKET_ORDER: readonly HeatBucket[] = [
  "overload",
  "working",
  "cold",
] as const;

const BUCKET_LABELS_RU: Record<HeatBucket, string> = {
  overload: "Перегруз · 15+ подходов",
  working: "В работе",
  cold: "Недогрет",
};

export function heatBucketLabel(bucket: HeatBucket): string {
  return BUCKET_LABELS_RU[bucket];
}

/** Разложить группы мышц по корзинам нагрева в каноническом порядке. Пустые
 *  корзины опускаются (нет «В работе»-секции, если все группы холодные).
 *  Внутри корзины порядок входных элементов сохраняется. */
export function groupByHeatBucket<T extends { level: HeatLevel }>(
  items: readonly T[],
): Array<{ bucket: HeatBucket; label: string; items: T[] }> {
  return HEAT_BUCKET_ORDER.map((bucket) => ({
    bucket,
    label: heatBucketLabel(bucket),
    items: items.filter((it) => heatBucket(it.level) === bucket),
  })).filter((group) => group.items.length > 0);
}
