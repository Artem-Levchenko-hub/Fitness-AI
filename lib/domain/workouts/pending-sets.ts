/**
 * H15.3b (под-слайс 2) — проекция офлайн-очереди (outbox) в отображаемые
 * подходы активной тренировки. Чистый домен: прячет форму payload-а мутации от
 * вью (R-01 deep module). Активная тренировка рендерится сервером (RSC), но
 * офлайн-записанные подходы лежат ТОЛЬКО в IndexedDB-outbox — этот модуль
 * восстанавливает их в стейт страницы, чтобы они были видны и пережили reload.
 *
 * Импорт типа `OutboxMutation` — type-only (никакого window/IndexedDB-IO в
 * домене, R-7): домен зависит лишь от ФОРМЫ мутации, не от storage-адаптера.
 * Защита R-10: битый/чужой payload отбрасывается поодиночке, а не роняет список.
 */

import type { OutboxMutation } from "../../storage/outbox";
import type { MyoSetRole } from "./myo-reps";

export type PendingSet = {
  /** Канонический client-UUID — он же ключ строки и идемпотентности. */
  clientId: string;
  workoutExerciseId: string;
  setIndex: number;
  weightKg: number;
  reps: number;
  rpe: number | null;
  myoRole: MyoSetRole | null;
  completedAt: Date;
};

function num(value: unknown): number | null {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Одна мутация → PendingSet для ЭТОЙ тренировки, либо null (чужая/битая). */
function toPendingSet(
  mutation: OutboxMutation,
  workoutId: string,
): PendingSet | null {
  if (mutation.kind !== "recordSet") return null;
  const p = mutation.payload;
  if (String(p.workoutId) !== workoutId) return null;

  const workoutExerciseId =
    typeof p.workoutExerciseId === "string" ? p.workoutExerciseId : null;
  const setIndex = num(p.setIndex);
  const weightKg = num(p.weightKg);
  const reps = num(p.reps);
  if (
    !workoutExerciseId ||
    setIndex == null ||
    weightKg == null ||
    reps == null
  ) {
    return null;
  }

  return {
    clientId: mutation.clientId,
    workoutExerciseId,
    setIndex,
    weightKg,
    reps,
    rpe: num(p.rpe),
    myoRole:
      p.myoRole === "activation" || p.myoRole === "mini"
        ? p.myoRole
        : null,
    completedAt: new Date(mutation.queuedAt),
  };
}

/** Все незадренированные подходы этой тренировки, отсортированы по setIndex. */
export function pendingSetsFromOutbox(
  mutations: OutboxMutation[],
  workoutId: string,
): PendingSet[] {
  return mutations
    .map((m) => toPendingSet(m, workoutId))
    .filter((s): s is PendingSet => s !== null)
    .sort((a, b) => a.setIndex - b.setIndex);
}

/**
 * H15.3c — есть ли в очереди незадренированное офлайн-ЗАВЕРШЕНИЕ этой тренировки.
 * Активная сессия рендерится сервером (status=active), но при офлайн-финише UI
 * показывает её завершённой оптимистично; этот флаг восстанавливает то состояние
 * на маунте (переживает reload). Реальный server-finish — дренаж H15.4.
 */
export function hasPendingFinish(
  mutations: OutboxMutation[],
  workoutId: string,
): boolean {
  return mutations.some(
    (m) => m.kind === "finishWorkout" && String(m.payload.workoutId) === workoutId,
  );
}

/** Подходы, сгруппированные по упражнению (каждая группа по setIndex). */
export function groupPendingByExerciseId(
  pending: PendingSet[],
): Map<string, PendingSet[]> {
  const byExercise = new Map<string, PendingSet[]>();
  for (const set of pending) {
    const group = byExercise.get(set.workoutExerciseId);
    if (group) group.push(set);
    else byExercise.set(set.workoutExerciseId, [set]);
  }
  for (const group of byExercise.values()) {
    group.sort((a, b) => a.setIndex - b.setIndex);
  }
  return byExercise;
}
