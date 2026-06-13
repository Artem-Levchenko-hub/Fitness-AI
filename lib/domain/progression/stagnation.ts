import { trendStatus, type TrendOptions } from "./trend";

/** Результат детекции застоя серии метрики (e1RM упражнения по сессиям). */
export type Stagnation = {
  /** true, если хвост подряд идущих НЕулучшающих переходов ≥ n. */
  stale: boolean;
  /** Длина хвоста подряд идущих {stagnant|regressed} переходов от новейшего
   *  конца серии (число сессий без прогресса). */
  streak: number;
};

/** H11.4 — застой упражнения: тренер предупреждает, а не только разбирает.
 *
 *  Свёртка ПОВЕРХ примитива `trendStatus` (он сравнивает ДВЕ точки prev→cur,
 *  не серию — R-04: переиспользуем семантику тренда, не дублируем её). Идём от
 *  новейшего конца серии к старому, считаем подряд идущие переходы со статусом
 *  `stagnant` ИЛИ `regressed`; первый `improved`/`new` обрывает хвост. n таких
 *  подряд → флаг застоя.
 *
 *  Это НЕ `STAGNANT_PCT` из lib/domain/stats/period-insight.ts — то про
 *  period-volume (другая сущность). Здесь — per-exercise streak e1RM.
 *
 *  series — хронологически (старое→новое). epsilon/higherIsBetter передаются
 *  примитиву (для e1RM — epsilon поглощает float-шум). Чистая функция (R-07). */
export function detectStagnation(
  series: readonly number[],
  n = 3,
  options: TrendOptions = {},
): Stagnation {
  let streak = 0;
  for (let i = series.length - 1; i >= 1; i--) {
    const status = trendStatus(series[i - 1], series[i]!, options);
    if (status === "stagnant" || status === "regressed") streak++;
    else break;
  }
  return { stale: streak >= n, streak };
}
