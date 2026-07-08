/** «Следующая тренировка от тренера»: прогрессивная перегрузка по завершённой
 *  силовой. Чистая доменная логика (R-7) — на вход выполненные подходы, на
 *  выход целевые параметры шаблона. Это ровно то, что делает тренер: даёт
 *  прогрессию по факту прошлой сессии (двойная прогрессия). */

/** Верхняя граница повторений (гипертрофия) для упражнений с весом: дошёл —
 *  добавляем вес и сбрасываем повторы вниз. Bodyweight потолком не ограничен. */
const REP_CEILING = 12;
const REP_FLOOR = 8;
/** Малый универсальный шаг веса (стандартная пара блинов 1.25 кг). */
const WEIGHT_STEP_KG = 2.5;
const DEFAULT_REST_SECONDS = 120;

export type WorkoutSetInput = {
  weightKg: number | null;
  reps: number;
  setType: string;
};

export type WorkoutExerciseInput = {
  exerciseId: string;
  sets: WorkoutSetInput[];
};

export type NextTemplateItem = {
  exerciseId: string;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  targetWeightKg: number | null;
  targetRestSeconds: number;
};

/** Прогрессия одного упражнения по его рабочим подходам. null — если рабочих
 *  подходов не было (упражнение в шаблон не попадает). */
function progressExercise(ex: WorkoutExerciseInput): NextTemplateItem | null {
  const working = ex.sets.filter((s) => s.setType === "working");
  if (working.length === 0) return null;

  const targetSets = working.length;
  const weighted = working.filter((s) => s.weightKg != null && s.weightKg > 0);

  if (weighted.length === 0) {
    // Bodyweight: прогрессируем повторы, без потолка 12 (выносливость растёт выше).
    const topReps = Math.max(...working.map((s) => s.reps));
    return {
      exerciseId: ex.exerciseId,
      targetSets,
      targetRepsMin: topReps + 1,
      targetRepsMax: topReps + 3,
      targetWeightKg: null,
      targetRestSeconds: DEFAULT_REST_SECONDS,
    };
  }

  const topWeight = Math.max(...weighted.map((s) => s.weightKg as number));
  // Повторы на самом тяжёлом подходе — прогрессируем именно его.
  const topReps = Math.max(
    ...weighted.filter((s) => s.weightKg === topWeight).map((s) => s.reps),
  );

  if (topReps >= REP_CEILING) {
    // Достиг потолка повторов → +вес, повторы вниз к полу диапазона.
    return {
      exerciseId: ex.exerciseId,
      targetSets,
      targetRepsMin: REP_FLOOR,
      targetRepsMax: REP_CEILING,
      targetWeightKg: topWeight + WEIGHT_STEP_KG,
      targetRestSeconds: DEFAULT_REST_SECONDS,
    };
  }

  // Ещё есть запас по повторам → тот же вес, цель — больше повторов.
  return {
    exerciseId: ex.exerciseId,
    targetSets,
    targetRepsMin: topReps + 1,
    targetRepsMax: Math.min(topReps + 3, REP_CEILING),
    targetWeightKg: topWeight,
    targetRestSeconds: DEFAULT_REST_SECONDS,
  };
}

/** Строит элементы шаблона «следующей тренировки» из завершённой силовой:
 *  по каждому упражнению — прогрессия по его рабочим подходам, в исходном
 *  порядке. Упражнения без рабочих подходов отбрасываются. */
export function buildNextTemplateItems(
  exercises: WorkoutExerciseInput[],
): NextTemplateItem[] {
  return exercises
    .map(progressExercise)
    .filter((it): it is NextTemplateItem => it !== null);
}

/** ТОЧНАЯ передача выполненного в шаблон (БЕЗ прогрессии) — «сохрани как шаблон
 *  ровно то, что я сделал». Отличие от buildNextTemplateItems: не добавляет вес
 *  и не двигает повторы вверх, а фиксирует факт: подходы = число рабочих,
 *  диапазон повторов = [min, max] реальных повторов, вес = самый тяжёлый рабочий
 *  подход (null для bodyweight). Основа «собери план из истории тренировок». */
function faithfulItem(ex: WorkoutExerciseInput): NextTemplateItem | null {
  const working = ex.sets.filter((s) => s.setType === "working");
  if (working.length === 0) return null;

  const reps = working.map((s) => s.reps);
  const repsMin = Math.min(...reps);
  const repsMax = Math.max(...reps);
  const weighted = working.filter((s) => s.weightKg != null && s.weightKg > 0);
  const topWeight =
    weighted.length > 0
      ? Math.max(...weighted.map((s) => s.weightKg as number))
      : null;

  return {
    exerciseId: ex.exerciseId,
    targetSets: working.length,
    targetRepsMin: repsMin,
    targetRepsMax: repsMax,
    targetWeightKg: topWeight,
    targetRestSeconds: DEFAULT_REST_SECONDS,
  };
}

/** Элементы шаблона из выполненной тренировки как есть (см. faithfulItem).
 *  Упражнения без рабочих подходов отбрасываются, порядок сохраняется. */
export function templateItemsFromWorkout(
  exercises: WorkoutExerciseInput[],
): NextTemplateItem[] {
  return exercises
    .map(faithfulItem)
    .filter((it): it is NextTemplateItem => it !== null);
}
