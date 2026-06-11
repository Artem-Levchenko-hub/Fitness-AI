/** Рендер per-упражнение тренда e1RM в markdown для AI-контекста (coach).
 *  Pure — зависит только от env-free `assessProgressJump` (R-7), без
 *  импортов из БД/Auth/UI → юнит-тестируемо. Несёт owner-facing формулировку
 *  G5-предупреждения о подозрительном скачке силы. */

import { assessProgressJump } from "../domain/progression/sanity";

export type OneRmTrendPoint = {
  nameRu: string;
  todayKg: number;
  previousKg: number | null;
};

/** Одна строка markdown про тренд e1RM упражнения: «прошлый → сегодня (±дельта)»,
 *  либо «нет прошлых данных», либо тот же ряд + G5-флаг подозрительного скачка. */
export function formatOneRmTrend(t: OneRmTrendPoint): string {
  if (t.previousKg == null || t.previousKg === 0) {
    return `- **${t.nameRu}**: сегодня e1RM ${t.todayKg.toFixed(1)} kg (нет прошлых данных)`;
  }
  const delta = t.todayKg - t.previousKg;
  const sign = delta >= 0 ? "+" : "";
  const base = `- **${t.nameRu}**: ${t.previousKg.toFixed(1)} → ${t.todayKg.toFixed(1)} kg (${sign}${delta.toFixed(1)})`;
  const jump = assessProgressJump(t.previousKg, t.todayKg);
  if (jump.suspicious) {
    const pctStr = Math.round(jump.pct * 100);
    return `${base} ⚠️ ПОДОЗРИТЕЛЬНЫЙ СКАЧОК (+${pctStr}% за сессию) — вероятно ошибка ввода (вес записан не к тому упражнению или опечатка); НЕ считать рекордом, не хвалить за этот прирост, мягко попросить атлета проверить введённые данные`;
  }
  return base;
}
