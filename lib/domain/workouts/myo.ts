/** Миорепсы (myo-reps, Borge Fagerli): 1 активационный подход почти до отказа
 *  (целевые targetRepsMin–Max), затем myoMiniSets коротких мини-сетов по
 *  myoMiniReps повторов с тем же весом и отдыхом myoMiniRestSeconds (10–20 с).
 *  Чистые правила протокола для активной тренировки: сколько подходов в плане,
 *  какой отдых и целевые повторы перед СЛЕДУЮЩИМ подходом. Подходы при этом —
 *  обычные working-строки (объём/PR/1RM без спец-веток: мини на том же весе с
 *  меньшими повторами никогда не перебьёт активационный по weight×reps). */

export type MyoProtocol = {
  myoReps: boolean;
  myoMiniSets: number;
  myoMiniReps: number;
  myoMiniRestSeconds: number;
};

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
 *  мини-сеты — фиксированные myoMiniReps. */
export function repsTargetForNextSet(
  targetRepsMin: number,
  targetRepsMax: number,
  p: MyoProtocol,
  doneCount: number,
): { min: number; max: number } {
  if (p.myoReps && doneCount >= 1) {
    return { min: p.myoMiniReps, max: p.myoMiniReps };
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
