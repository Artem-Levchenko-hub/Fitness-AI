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

export type AdaptItem = {
  exerciseId: string;
  position: number;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  targetWeightKg: number | null;
  targetRestSeconds: number;
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
): InPlaceAdaptation {
  const next = buildNextTemplateItems(performed);
  const merged = mergeProgressionIntoItems(current, next);

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
      notes: null,
    };
  });

  return { items, swap };
}
