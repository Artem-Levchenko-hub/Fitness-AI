/** Миорепсы (myo-reps, Borge Fagerli): 1 активационный подход почти до отказа
 *  (целевые targetRepsMin–Max), затем myoMiniSets коротких мини-сетов примерно
 *  по 30% повторов активационного с тем же весом и коротким отдыхом.
 *  Чистые правила протокола для активной тренировки: сколько подходов в плане,
 *  какой отдых и целевые повторы перед СЛЕДУЮЩИМ подходом. Подходы при этом —
 *  обычные working-строки (объём/PR/1RM без спец-веток: мини на том же весе с
 *  меньшими повторами никогда не перебьёт активационный по weight×reps). */

export const MYO_MINI_REPS_PERCENT = 30;

export type MyoProtocol = {
  myoReps: boolean;
  myoMiniSets: number;
  /** Legacy fallback for workouts where activation reps are unavailable. */
  myoMiniReps: number;
  myoMiniRestSeconds: number;
};

export function myoMiniRepsFromActivation(
  activationReps: number,
  percent = MYO_MINI_REPS_PERCENT,
): number {
  const safeReps = Math.max(1, activationReps);
  const safePercent = Math.min(50, Math.max(10, percent));
  return Math.max(1, Math.round((safeReps * safePercent) / 100));
}

export function elapsedRestSeconds(
  startedAt: Date | null,
  nowMs = Date.now(),
): number | null {
  if (!startedAt) return null;
  return Math.min(
    3600,
    Math.max(0, Math.round((nowMs - startedAt.getTime()) / 1000)),
  );
}

/** План подходов упражнения: миорепсы = активационный + мини-сеты,
 *  иначе — обычные targetSets. */
export function plannedSetCount(targetSets: number, p: MyoProtocol): number {
  if (!p.myoReps) return targetSets;
  return 1 + Math.max(1, p.myoMiniSets);
}

/** Отдых перед следующим подходом: внутри миорепс-серии (после активационного)
 *  — короткий мини-отдых, до первого подхода и в обычном режиме — целевой. */
export function restBeforeNextSet(
  targetRestSeconds: number,
  p: MyoProtocol,
  doneCount: number,
): number {
  if (p.myoReps && doneCount >= 1) return p.myoMiniRestSeconds;
  return targetRestSeconds;
}

/** Целевые повторы следующего подхода: активационный — диапазон шаблона,
 *  мини-сеты — 30% от фактически выполненной активации. myoMiniReps остаётся
 *  fallback для старых/неполных данных. */
export function repsTargetForNextSet(
  targetRepsMin: number,
  targetRepsMax: number,
  p: MyoProtocol,
  doneCount: number,
  activationReps?: number | null,
): { min: number; max: number } {
  if (p.myoReps && doneCount >= 1) {
    const reps =
      activationReps == null
        ? p.myoMiniReps
        : myoMiniRepsFromActivation(activationReps);
    return { min: reps, max: reps };
  }
  return { min: targetRepsMin, max: targetRepsMax };
}

/** Подпись фазы следующего подхода для UI: «активационный» / «мини K/N».
 *  null — упражнение не в режиме миорепсов. */
export function myoPhaseLabel(
  p: MyoProtocol,
  doneCount: number,
): string | null {
  if (!p.myoReps) return null;
  if (doneCount === 0) return "активационный";
  return `мини ${doneCount}/${Math.max(1, p.myoMiniSets)}`;
}
