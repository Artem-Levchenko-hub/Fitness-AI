/** Семантика тренда метрики во времени — общая для AI-разбора (F4) и
 *  графиков прогресса (F7). Один источник правды: цвета/иконки в UI и
 *  оценки тренера используют одни и те же 4 состояния. */
export type TrendStatus = "improved" | "regressed" | "stagnant" | "new";

/** Человекочитаемая подпись статуса (бейдж на графике, легенда). */
export const TREND_LABEL: Record<TrendStatus, string> = {
  improved: "Рост",
  regressed: "Регресс",
  stagnant: "Стагнация",
  new: "Новое",
};

export type TrendOptions = {
  /** Зона нечувствительности: |cur - prev| <= epsilon → "stagnant".
   *  Защита от шума измерений (например float e1RM). По умолчанию 0. */
  epsilon?: number;
  /** Больше = лучше (e1RM, объём). Для метрик, где направление не
   *  означает прогресс (вес тела), вызывающий решает сам. По умолчанию true. */
  higherIsBetter?: boolean;
};

/** Классифицирует изменение числовой метрики prev→cur в один из 4 статусов.
 *  prev == null/undefined → "new" (нет истории для сравнения). */
export function trendStatus(
  prev: number | null | undefined,
  cur: number,
  options: TrendOptions = {},
): TrendStatus {
  if (prev == null) return "new";

  const { epsilon = 0, higherIsBetter = true } = options;
  const delta = cur - prev;

  if (Math.abs(delta) <= epsilon) return "stagnant";

  const isUp = delta > 0;
  const isGood = higherIsBetter ? isUp : !isUp;
  return isGood ? "improved" : "regressed";
}
