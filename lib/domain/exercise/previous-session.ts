import type { ExerciseSession } from "./set-history";

/** «Прошлый раз» в точке решения активной тренировки (H12.1): из последней
 *  завершённой сессии упражнения даёт строку подходов + вес для префилла
 *  первого подхода. Рабочие подходы приоритетны (как findPreviousSession в
 *  AI-контексте H5.3) — если их нет, берём все. Pure (R-7), юнит-тестируемо. */
export type PreviousSessionSummary = {
  sets: Array<{ weightKg: number; reps: number }>;
  /** Вес последнего показанного подхода — префилл первого подхода сегодня. */
  prefillWeightKg: number;
};

export function summarizePreviousSession(
  session: ExerciseSession | null,
): PreviousSessionSummary | null {
  if (!session || session.sets.length === 0) return null;

  const working = session.sets.filter((s) => s.setType === "working");
  const chosen = working.length > 0 ? working : session.sets;
  if (chosen.length === 0) return null;

  const sets = chosen.map((s) => ({ weightKg: s.weightKg, reps: s.reps }));
  return { sets, prefillWeightKg: sets[sets.length - 1].weightKg };
}
