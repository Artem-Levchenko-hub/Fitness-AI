import { trendStatus } from "./trend";

/** H18.1 — проекция прогресса к цели: «где я сейчас → дойду ли и когда».
 *  Чистая функция поверх trend.ts (один источник классификации динамики).
 *  Все виды целей (вес/1ПМ/частота) — «больше = лучше», поэтому направление
 *  не параметризуется (YAGNI; если появится метрика, где меньше = лучше,
 *  добавить higherIsBetter тогда). UI/AI поверх — отдельные слайсы (H18.2/H18.3). */
export type GoalProjection = {
  /** Последнее значение метрики. undefined при пустой истории. */
  current?: number;
  /** Сдвиг от первой точки к текущей (last − first). undefined при пустой истории. */
  deltaSinceStart?: number;
  /** Средний недельный темп к цели. Определён ТОЛЬКО при росте (trendStatus
   *  improved); застой/регресс/одна точка → undefined (темпа к цели нет). */
  paceToTarget?: number;
  /** Оценка недель до цели: (target − current) / paceToTarget. 0 если цель уже
   *  достигнута. undefined, если темп undefined либо ≤ 0 (защита от Infinity). */
  etaWeeks?: number;
};

export type ProjectProgressOptions = {
  /** Зона нечувствительности: |last − first| ≤ epsilon → застой → pace undefined.
   *  Защита от шума измерений (например float e1RM). По умолчанию 0. */
  epsilon?: number;
};

/** Считает проекцию по ряду значений метрики (хронологический порядок,
 *  старое→новое — например тоннаж/e1RM по неделям) к числовой цели. */
export function projectProgress(
  history: number[],
  targetValue: number,
  options: ProjectProgressOptions = {},
): GoalProjection {
  if (history.length === 0) return {};

  const { epsilon = 0 } = options;
  const first = history[0];
  const current = history[history.length - 1];
  const deltaSinceStart = current - first;

  // Темп определён лишь при реальном росте: trendStatus отсекает застой
  // (|Δ| ≤ epsilon) и регресс (Δ < 0) → их avgΔ дал бы Infinity/отрицательную ETA.
  const trend = trendStatus(first, current, { epsilon });
  const weeks = history.length - 1; // интервалов между точками
  const paceToTarget =
    trend === "improved" && weeks > 0 ? deltaSinceStart / weeks : undefined;

  let etaWeeks: number | undefined;
  if (current >= targetValue) {
    etaWeeks = 0; // цель достигнута
  } else if (paceToTarget !== undefined && paceToTarget > 0) {
    etaWeeks = (targetValue - current) / paceToTarget;
  }

  return { current, deltaSinceStart, paceToTarget, etaWeeks };
}

/** H18.2 — view-model read-only трек-бара «текущее → цель» для UI.
 *  Тонкий пресентер поверх projectProgress: переводит undefined-поля в
 *  null (UI-дружелюбно) и считает долю заполнения `pct` = current/target,
 *  склампленную в [0,1]. Чистая функция (R-7) — без UI/БД, тестируется без них. */
export type GoalProgressView = {
  /** Текущее значение метрики; null при пустой истории (цель есть, истории нет). */
  current: number | null;
  /** Целевое значение (как задано). */
  target: number;
  /** Доля прогресса [0,1] для ширины полосы. 0 при отсутствии current/target≤0. */
  pct: number;
  /** Оценка недель до цели; null если темпа нет (застой/регресс) или цель достигнута даёт 0. */
  etaWeeks: number | null;
  /** Цель достигнута (current ≥ target). */
  reached: boolean;
};

export function summarizeGoalProgress(
  series: number[],
  targetValue: number,
  options: ProjectProgressOptions = {},
): GoalProgressView {
  const proj = projectProgress(series, targetValue, options);
  const current = proj.current ?? null;
  const reached = current !== null && current >= targetValue;
  const pct =
    current === null || targetValue <= 0
      ? 0
      : Math.min(1, Math.max(0, current / targetValue));
  return {
    current,
    target: targetValue,
    pct,
    etaWeeks: proj.etaWeeks ?? null,
    reached,
  };
}
