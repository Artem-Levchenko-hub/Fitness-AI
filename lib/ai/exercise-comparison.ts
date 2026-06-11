/** Per-упражнение блок «сравнение с прошлым» для AI-контекста (H5.3).
 *  Для каждого упражнения сегодняшней силовой даёт тренеру ТРИ конкретных
 *  опоры в цифрах: (1) прошлая сессия этого упражнения set-by-set, (2) тренд
 *  e1RM (reuse formatOneRmTrend — несёт G5-флаг скачка), (3) дистанцию до
 *  личного рекорда за всю историю. Pure — без импортов из БД/Auth/UI (R-7),
 *  юнит-тестируемо. */

import { formatOneRmTrend, type OneRmTrendPoint } from "./one-rm-trend";

export type ExerciseComparisonPoint = {
  nameRu: string;
  /** Тренд e1RM (прошлый лучший в окне → сегодня). Рендерится reuse-функцией. */
  trend: OneRmTrendPoint;
  /** Последняя прошлая сессия ЭТОГО упражнения (set-by-set) или null (первый раз). */
  previousSession: {
    dateLabel: string;
    sets: Array<{ weightKg: number; reps: number }>;
  } | null;
  /** Лучший e1RM за всю историю ДО сегодня (null/0 — сегодня первый замер). */
  allTimeBestE1rm: number | null;
};

/** Дистанция сегодняшнего e1RM до личного рекорда за всё время. */
function formatPrDistance(
  todayE1rm: number,
  bestBeforeToday: number | null,
): string {
  if (bestBeforeToday == null || bestBeforeToday <= 0) {
    return `- рекорд: первый зафиксированный e1RM (${todayE1rm.toFixed(1)} kg)`;
  }
  if (todayE1rm >= bestBeforeToday) {
    const delta = todayE1rm - bestBeforeToday;
    return `- 🏆 новый личный рекорд e1RM ${todayE1rm.toFixed(1)} kg (прошлый лучший ${bestBeforeToday.toFixed(1)} kg, +${delta.toFixed(1)})`;
  }
  const gap = bestBeforeToday - todayE1rm;
  const pct = (gap / bestBeforeToday) * 100;
  return `- до личного рекорда e1RM ${bestBeforeToday.toFixed(1)} kg: −${gap.toFixed(1)} kg (${pct.toFixed(1)}% ниже PR)`;
}

/** Markdown-блок одного упражнения: прошлая сессия + тренд + дистанция до PR. */
export function formatExerciseComparison(p: ExerciseComparisonPoint): string {
  const lines = [`## ${p.nameRu}`];

  if (p.previousSession && p.previousSession.sets.length > 0) {
    const setsStr = p.previousSession.sets
      .map((s) => `${s.weightKg}×${s.reps}`)
      .join(", ");
    lines.push(`- прошлая сессия (${p.previousSession.dateLabel}): ${setsStr}`);
  } else {
    lines.push("- прошлых сессий этого упражнения нет (первый раз)");
  }

  lines.push(formatOneRmTrend(p.trend));
  lines.push(formatPrDistance(p.trend.todayKg, p.allTimeBestE1rm));

  return lines.join("\n");
}
