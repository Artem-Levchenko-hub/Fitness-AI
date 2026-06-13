/**
 * H10.4 — черновик НЕсабмитнутого ввода подхода. Вес/повторы/RPE, набранные в
 * `SetInput`, но ещё не записанные на сервер, переживают reload/краш через
 * localStorage (ключ = workoutExerciseId). Это НЕ офлайн-очередь сабмитов
 * (это H15.3) — только страховка от потери НЕсабмитнутого ввода.
 *
 * Пьюр-функции (key/serialize/parse/isEmpty) — без window, юнит-тестируемы в
 * node-окружении vitest. Адаптер (load/save/clear) трогает localStorage и
 * защищён от SSR/quota (fail-soft R-10) — его проверяет рантайм, не юнит.
 */

export type SetInputDraft = {
  weight: string;
  reps: string;
  rpe: string;
};

const KEY_PREFIX = "fit:set-draft:";

export function setDraftKey(workoutExerciseId: string): string {
  return `${KEY_PREFIX}${workoutExerciseId}`;
}

export function isEmptySetDraft(draft: SetInputDraft): boolean {
  return !draft.weight && !draft.reps && !draft.rpe;
}

export function serializeSetDraft(draft: SetInputDraft): string {
  // Короткие ключи — localStorage не безразмерен, а на активной тренировке
  // черновиков может быть по строке на упражнение.
  return JSON.stringify({ w: draft.weight, r: draft.reps, e: draft.rpe });
}

export function parseSetDraft(raw: string | null): SetInputDraft | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const draft: SetInputDraft = {
      weight: typeof obj.w === "string" ? obj.w : "",
      reps: typeof obj.r === "string" ? obj.r : "",
      rpe: typeof obj.e === "string" ? obj.e : "",
    };
    // Пустой черновик восстанавливать нечего — как будто его и нет.
    return isEmptySetDraft(draft) ? null : draft;
  } catch {
    return null;
  }
}

export function loadSetDraft(workoutExerciseId: string): SetInputDraft | null {
  if (typeof window === "undefined") return null;
  try {
    return parseSetDraft(window.localStorage.getItem(setDraftKey(workoutExerciseId)));
  } catch {
    return null;
  }
}

export function saveSetDraft(
  workoutExerciseId: string,
  draft: SetInputDraft,
): void {
  if (typeof window === "undefined") return;
  try {
    const key = setDraftKey(workoutExerciseId);
    if (isEmptySetDraft(draft)) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, serializeSetDraft(draft));
  } catch {
    /* quota/приватный режим — потеря черновика не должна ронять ввод подхода */
  }
}

export function clearSetDraft(workoutExerciseId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(setDraftKey(workoutExerciseId));
  } catch {
    /* fail-soft */
  }
}
