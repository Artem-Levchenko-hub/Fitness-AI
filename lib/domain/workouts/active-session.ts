import { plannedSetCount } from "./myo";

export const AUTO_FINISH_IDLE_MS = 60 * 60 * 1000;

/** Возраст не отменяет незавершённую тренировку. Статус проверяет репозиторий. */
export function isResumable(startedAt: Date, _now?: Date): boolean {
  return Number.isFinite(startedAt.getTime());
}

type PlannedExercise = {
  targetSets: number;
  myoReps: boolean;
  myoMiniSets: number;
  sets: readonly unknown[];
  replacedAt?: Date | null;
};

/** Час отсчитывается от записи на сервере, а не от часов офлайн-клиента.
 *  Пустой/неполный план остаётся активным до явного решения пользователя. */
export function strengthAutoFinishAt(
  exercises: readonly PlannedExercise[],
  lastSavedAt: Date | null,
): Date | null {
  if (!lastSavedAt || !Number.isFinite(lastSavedAt.getTime()) || exercises.length === 0) return null;
  const planned = exercises.filter((exercise) => !exercise.replacedAt);
  if (planned.length === 0) return null;
  const complete = planned.every((exercise) => {
    const count = plannedSetCount(exercise.targetSets, {
      ...exercise, myoMiniReps: 5, myoMiniRestSeconds: 20,
    });
    return count > 0 && exercise.sets.length >= count;
  });
  return complete ? new Date(lastSavedAt.getTime() + AUTO_FINISH_IDLE_MS) : null;
}
