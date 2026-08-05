/** Адаптация шаблона-дня программы НА МЕСТЕ по завершённой тренировке. Это то,
 *  что обещано пользователю: программа из библиотеки после первого прохода
 *  меняется прямо в шаблоне — тренер правит вес/повторы, изредка свапает
 *  упражнение. Чистая доменная логика (R-07): решение о застое и поиск замены —
 *  на стороне вызывающего (нужна история из БД), здесь только склейка. */

import {
  buildNextTemplateItems,
  type NextTemplateItem,
  type WorkoutExerciseInput,
} from "@/lib/domain/templates/next-template";
import { myoMiniRepsFromActivation } from "@/lib/domain/workouts/myo";
import type { TrainingReadiness } from "@/lib/domain/trainer/recovery-readiness";

export type AdaptItem = {
  exerciseId: string;
  position: number;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  targetWeightKg: number | null;
  targetRestSeconds: number;
  myoReps?: boolean;
  myoMiniSets?: number;
  myoMiniReps?: number;
  myoMiniRestSeconds?: number;
  notes?: string | null;
};

/** Свежий старт заменённого упражнения: истории нет, диапазон по умолчанию. */
const SWAP_REPS_MIN = 8;
const SWAP_REPS_MAX = 12;

/** Накладывает прогрессию (next по exerciseId) на текущие элементы шаблона-дня:
 *  у каждого совпавшего упражнения обновляет цели (подходы/повторы/вес/отдых),
 *  сохраняя само упражнение, позицию и заметки. Упражнение без прогрессии
 *  (не выполнялось рабочими подходами) остаётся как было — структура дня
 *  программы стабильна, меняются только цели. Чистая (R-07). */
export function mergeProgressionIntoItems(
  current: AdaptItem[],
  next: NextTemplateItem[],
): AdaptItem[] {
  const byId = new Map(next.map((n) => [n.exerciseId, n]));
  return current.map((cur) => {
    const n = byId.get(cur.exerciseId);
    if (!n) return cur;
    return {
      ...cur,
      targetSets: n.targetSets,
      targetRepsMin: n.targetRepsMin,
      targetRepsMax: n.targetRepsMax,
      targetWeightKg: n.targetWeightKg,
      targetRestSeconds: n.targetRestSeconds,
    };
  });
}

export type SubstituteCandidate = {
  exerciseId: string;
  primaryMuscles: readonly string[];
  /** Сам застойный кандидат не годится в замену — не свапаем застой на застой. */
  isStagnant: boolean;
};

/** Подбор замены застойному упражнению: первый кандидат, который делит хотя бы
 *  одну первичную группу мышц, сам не застойный и не в списке исключений
 *  (например, уже присутствует в шаблоне). Детерминирован — стабильный порядок
 *  кандидатов задаёт вызывающий (напр. по slug). null — подходящей замены нет.
 *  Чистая (R-07). */
export function pickSubstitute(
  primaryMuscles: readonly string[],
  candidates: readonly SubstituteCandidate[],
  excludeIds: readonly string[],
): string | null {
  const exclude = new Set(excludeIds);
  const muscles = new Set(primaryMuscles);
  for (const c of candidates) {
    if (exclude.has(c.exerciseId)) continue;
    if (c.isStagnant) continue;
    if (c.primaryMuscles.some((m) => muscles.has(m))) return c.exerciseId;
  }
  return null;
}

export type InPlaceAdaptation = {
  items: AdaptItem[];
  swap: { fromExerciseId: string; toExerciseId: string } | null;
};

function adaptMyoItem(
  current: AdaptItem,
  performed: WorkoutExerciseInput | undefined,
  holdProgression: boolean,
): AdaptItem {
  const activation = performed?.sets.find((set) => set.setType === "working");
  if (!activation) return current;

  const activationWeight = activation.weightKg ?? current.targetWeightKg;
  const min = current.targetRepsMin;
  const max = current.targetRepsMax;
  let targetWeightKg = activationWeight;

  // При caution сохраняем прежнюю нагрузку: дневники восстановления никогда не
  // становятся поводом автоматически давить вес/повторы вверх или вниз.
  if (!holdProgression && activationWeight != null) {
    if (activation.reps >= max) targetWeightKg = activationWeight + 2.5;
    else if (activation.reps < min) {
      const reduced = activationWeight - 2.5;
      targetWeightKg = reduced > 0 ? reduced : null;
    }
  }

  return {
    ...current,
    // Myo — один активационный плюс мини-сеты: никогда не превращаем мини-сеты
    // в число обычных рабочих подходов после завершения тренировки.
    targetSets: 1,
    targetWeightKg,
    myoMiniSets: Math.max(1, current.myoMiniSets ?? 3),
    myoMiniReps: myoMiniRepsFromActivation(activation.reps),
    myoMiniRestSeconds: Math.min(30, Math.max(5, current.myoMiniRestSeconds ?? 20)),
  };
}

/** Строит адаптацию шаблона-дня НА МЕСТЕ по завершённой тренировке:
 *  1) прогрессия по факту (buildNextTemplateItems) накладывается на текущие цели;
 *  2) не более ОДНОГО свапа упражнения — первого по позиции, для которого
 *     вызывающий заранее подобрал замену (substitutes[exerciseId]). Заменённое
 *     упражнение получает свежий старт (вес null, повторы 8–12), число подходов
 *     и отдых сохраняются. Один свап за раз — «изредка», чтобы не выпотрошить
 *     шаблон. Чистая (R-07): детект застоя и подбор кандидата — у вызывающего. */
export function buildInPlaceAdaptation(
  current: AdaptItem[],
  performed: WorkoutExerciseInput[],
  substitutes: Record<string, string> = {},
  options: { readiness?: TrainingReadiness } = {},
): InPlaceAdaptation {
  const holdProgression = options.readiness === "caution";
  const normalExerciseIds = new Set(
    current.filter((item) => !item.myoReps).map((item) => item.exerciseId),
  );
  const next = holdProgression
    ? []
    : buildNextTemplateItems(
        performed.filter((item) => normalExerciseIds.has(item.exerciseId)),
      );
  const standardMerged = mergeProgressionIntoItems(current, next);
  const performedByExerciseId = new Map(
    performed.map((item) => [item.exerciseId, item]),
  );
  const merged = standardMerged.map((item) =>
    item.myoReps
      ? adaptMyoItem(item, performedByExerciseId.get(item.exerciseId), holdProgression)
      : item,
  );

  let swap: InPlaceAdaptation["swap"] = null;
  const items = merged.map((it) => {
    if (swap) return it; // единственный свап уже сделан
    const sub = substitutes[it.exerciseId];
    if (!sub || sub === it.exerciseId) return it;
    swap = { fromExerciseId: it.exerciseId, toExerciseId: sub };
    return {
      ...it,
      exerciseId: sub,
      targetWeightKg: null,
      targetRepsMin: SWAP_REPS_MIN,
      targetRepsMax: SWAP_REPS_MAX,
      myoReps: false,
      myoMiniSets: 3,
      myoMiniReps: 5,
      myoMiniRestSeconds: 20,
      notes: null,
    };
  });

  return { items, swap };
}
