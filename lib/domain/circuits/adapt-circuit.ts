/** Адаптация кругового ШАБЛОНА на месте по завершённой сессии. Это обещание
 *  пользователю «отдаться тренеру»: после первой круговой по шаблону тренер сам
 *  правит цели под факт — повторы/время, вес, отдых между кругами и
 *  упражнениями, число кругов, а в крайнем случае подсказывает замену
 *  упражнения. Чистая доменная логика (R-7): на вход план + агрегаты факта, на
 *  выход новый план + список изменений + хинты на свап. Подбор замены (нужны
 *  мышцы/каталог) и запись в БД — у вызывающего (зеркало adapt.ts силовых). */

export type CircuitKind = "reps" | "duration";

export type CircuitPlanExercise = {
  exerciseId: string;
  kind: CircuitKind;
  targetReps: number | null;
  targetDurationSec: number | null;
  targetWeightKg: number | null;
};

export type CircuitPlan = {
  totalRounds: number;
  restBetweenRoundsSec: number;
  restBetweenExercisesSec: number;
  exercises: CircuitPlanExercise[];
};

/** Агрегаты факта по упражнению (из circuit_round_logs, не-skip круги). */
export type CircuitPerfExercise = {
  exerciseId: string;
  medianReps: number | null;
  medianDurationSec: number | null;
  medianWeightKg: number | null;
  /** Сколько кругов реально отработано по этому упражнению (≥1 не-skip лог). */
  completedRounds: number;
  /** Нет ни одного не-skip лога — упражнение фактически не делалось. */
  noData: boolean;
};

export type CircuitPerf = {
  byExercise: Record<string, CircuitPerfExercise>;
  /** Макс. номер круга с хотя бы одной не-skip отметкой во всей сессии. */
  roundsCompleted: number;
  /** Медиана RPE по всем не-skip логам. null — не отмечали. */
  medianRpe: number | null;
};

export type CircuitChange =
  | { type: "reps"; exerciseId: string; from: number | null; to: number }
  | { type: "duration"; exerciseId: string; from: number | null; to: number }
  | {
      type: "weight";
      exerciseId: string;
      from: number | null;
      to: number | null;
    }
  | { type: "rounds"; from: number; to: number }
  | { type: "restRounds"; from: number; to: number }
  | { type: "restExercises"; from: number; to: number }
  | { type: "swap"; exerciseId: string };

export type CircuitAdaptation = {
  plan: CircuitPlan;
  changes: CircuitChange[];
  /** Упражнения-кандидаты на замену (крайний случай: фактически не тянет).
   *  Резолв конкретной замены — у вызывающего; применяется не более одной. */
  swapHints: string[];
};

// Диапазоны = zod-границы круговой (server/actions/circuits.ts).
const REPS_MIN = 1;
const REPS_MAX = 500;
const DUR_MIN = 1;
const DUR_MAX = 60 * 60;
const ROUNDS_MIN = 1;
const ROUNDS_MAX = 30;
const REST_MIN = 0;
const REST_MAX = 60 * 60;
const WEIGHT_MIN = 0;
const WEIGHT_MAX = 1000;

/** RPE-пороги: «тяжело» → больше отдыха/меньше объёма; «легко» → прогресс. */
const RPE_HARD = 8.5;
const RPE_EASY = 7;

/** Сильное недовыполнение (3 из 10 = 0.3) → подгон цели вниз к факту. */
const UNDER_RATIO = 0.95;
/** Катастрофа (≤35% плана) → кандидат на свап упражнения. */
const SWAP_RATIO = 0.35;
/** Достаточно «попал в план» для прогрессии при лёгком RPE. */
const HIT_RATIO = 0.95;
/** План явно занижен (махи 5 → делал 20 = 4.0) → поднять цель к факту. */
const OVER_RATIO = 1.1;

const clamp = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, n));

/** Медиана числового ряда. null — пустой ряд. Чистая. */
export function median(xs: number[]): number | null {
  const v = xs.filter((x) => Number.isFinite(x)).slice().sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[mid]! : (v[mid - 1]! + v[mid]!) / 2;
}

/** Шаг прогрессии повторов: мелкие цели растут на 1, средние на 2, крупные ~10%. */
function repsStep(target: number): number {
  if (target < 10) return 1;
  if (target < 20) return 2;
  return Math.max(1, Math.round(target * 0.1));
}

/** Шаг прогрессии длительности (сек). */
function durStep(target: number): number {
  if (target < 60) return 5;
  if (target < 180) return 10;
  return Math.max(1, Math.round(target * 0.1));
}

/** Новая цель «по повторам/времени» по соотношению факт/план и RPE. */
function nextTarget(
  target: number,
  actual: number,
  step: number,
  rpe: number | null,
): number {
  const ratio = actual / target;
  if (ratio < UNDER_RATIO) return Math.round(actual); // не дотянул → к факту вниз
  if (ratio <= OVER_RATIO) {
    // Попал в план: лёгкий RPE → прогресс; иначе держим.
    return rpe != null && rpe <= RPE_EASY ? target + step : target;
  }
  return Math.round(actual); // перевыполнил → план занижен, поднять к факту
}

/** Строит адаптацию кругового шаблона по факту сессии (чистая, R-7). */
export function buildCircuitAdaptation(
  plan: CircuitPlan,
  perf: CircuitPerf,
): CircuitAdaptation {
  const changes: CircuitChange[] = [];
  const swapHints: string[] = [];
  const rpe = perf.medianRpe;

  const exercises: CircuitPlanExercise[] = plan.exercises.map((ex) => {
    const p = perf.byExercise[ex.exerciseId];
    if (!p || p.noData) return ex; // не делалось → не трогаем
    let next = ex;

    if (ex.kind === "reps" && ex.targetReps != null && p.medianReps != null) {
      const ratio = p.medianReps / ex.targetReps;
      const to = clamp(
        nextTarget(ex.targetReps, p.medianReps, repsStep(ex.targetReps), rpe),
        REPS_MIN,
        REPS_MAX,
      );
      if (to !== ex.targetReps) {
        changes.push({
          type: "reps",
          exerciseId: ex.exerciseId,
          from: ex.targetReps,
          to,
        });
        next = { ...next, targetReps: to };
      }
      if (ratio <= SWAP_RATIO) swapHints.push(ex.exerciseId);
    }

    if (
      ex.kind === "duration" &&
      ex.targetDurationSec != null &&
      p.medianDurationSec != null
    ) {
      const ratio = p.medianDurationSec / ex.targetDurationSec;
      const to = clamp(
        nextTarget(
          ex.targetDurationSec,
          p.medianDurationSec,
          durStep(ex.targetDurationSec),
          rpe,
        ),
        DUR_MIN,
        DUR_MAX,
      );
      if (to !== ex.targetDurationSec) {
        changes.push({
          type: "duration",
          exerciseId: ex.exerciseId,
          from: ex.targetDurationSec,
          to,
        });
        next = { ...next, targetDurationSec: to };
      }
      if (ratio <= SWAP_RATIO) swapHints.push(ex.exerciseId);
    }

    // Вес: ориентир по тому же соотношению (reps/время). Лёгкий + попал → +2.5;
    // сильно не тянул → к фактической медиане.
    if (ex.targetWeightKg != null && p.medianWeightKg != null) {
      const metric =
        ex.kind === "reps"
          ? ex.targetReps != null && p.medianReps != null
            ? p.medianReps / ex.targetReps
            : null
          : ex.targetDurationSec != null && p.medianDurationSec != null
            ? p.medianDurationSec / ex.targetDurationSec
            : null;
      let to: number | null = null;
      if (
        metric != null &&
        metric >= HIT_RATIO &&
        rpe != null &&
        rpe <= RPE_EASY
      ) {
        to = clamp(ex.targetWeightKg + 2.5, WEIGHT_MIN, WEIGHT_MAX);
      } else if (metric != null && metric < UNDER_RATIO) {
        to = clamp(Math.round(p.medianWeightKg * 2) / 2, WEIGHT_MIN, WEIGHT_MAX);
      }
      if (to != null && to !== ex.targetWeightKg) {
        changes.push({
          type: "weight",
          exerciseId: ex.exerciseId,
          from: ex.targetWeightKg,
          to,
        });
        next = { ...next, targetWeightKg: to };
      }
    }

    return next;
  });

  // Число кругов: не прошёл план → ставим столько, сколько реально осилил;
  // прошёл всё и легко → +1.
  let totalRounds = plan.totalRounds;
  if (perf.roundsCompleted >= 1 && perf.roundsCompleted < plan.totalRounds) {
    totalRounds = clamp(perf.roundsCompleted, ROUNDS_MIN, ROUNDS_MAX);
  } else if (
    perf.roundsCompleted >= plan.totalRounds &&
    rpe != null &&
    rpe <= RPE_EASY
  ) {
    totalRounds = clamp(plan.totalRounds + 1, ROUNDS_MIN, ROUNDS_MAX);
  }
  if (totalRounds !== plan.totalRounds) {
    changes.push({ type: "rounds", from: plan.totalRounds, to: totalRounds });
  }

  // Отдых между кругами: тяжело → +20с; легко и всё пройдено → −10с.
  let restRounds = plan.restBetweenRoundsSec;
  if (rpe != null && rpe >= RPE_HARD) {
    restRounds = clamp(plan.restBetweenRoundsSec + 20, REST_MIN, REST_MAX);
  } else if (
    rpe != null &&
    rpe <= RPE_EASY &&
    perf.roundsCompleted >= plan.totalRounds
  ) {
    restRounds = clamp(plan.restBetweenRoundsSec - 10, REST_MIN, REST_MAX);
  }
  if (restRounds !== plan.restBetweenRoundsSec) {
    changes.push({
      type: "restRounds",
      from: plan.restBetweenRoundsSec,
      to: restRounds,
    });
  }

  // Отдых между упражнениями: мягче (тяжело → +10с; легко → −5с).
  let restEx = plan.restBetweenExercisesSec;
  if (rpe != null && rpe >= RPE_HARD) {
    restEx = clamp(plan.restBetweenExercisesSec + 10, REST_MIN, REST_MAX);
  } else if (rpe != null && rpe <= RPE_EASY) {
    restEx = clamp(plan.restBetweenExercisesSec - 5, REST_MIN, REST_MAX);
  }
  if (restEx !== plan.restBetweenExercisesSec) {
    changes.push({
      type: "restExercises",
      from: plan.restBetweenExercisesSec,
      to: restEx,
    });
  }

  return {
    plan: {
      totalRounds,
      restBetweenRoundsSec: restRounds,
      restBetweenExercisesSec: restEx,
      exercises,
    },
    changes,
    swapHints,
  };
}

/** Свежая цель заменённого упражнения (свап): вес сбрасываем, цель — мягкий
 *  старт по типу (повторы 10 / 30 сек). Чистая. */
export function freshSwapTarget(kind: CircuitKind): {
  targetReps: number | null;
  targetDurationSec: number | null;
  targetWeightKg: number | null;
} {
  return kind === "reps"
    ? { targetReps: 10, targetDurationSec: null, targetWeightKg: null }
    : { targetReps: null, targetDurationSec: 30, targetWeightKg: null };
}
