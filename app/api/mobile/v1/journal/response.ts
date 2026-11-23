import type { ActiveWorkout } from "@/lib/repos/workouts.repo";
import { strengthAutoFinishAt } from "@/lib/domain/workouts/active-session";

export function journalJson(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function serializeJournalWorkout(workout: ActiveWorkout) {
  const saved = workout.exercises.flatMap((exercise) => exercise.sets.map((set) => set.savedAt))
    .filter((at): at is Date => at instanceof Date && Number.isFinite(at.getTime()));
  const lastSavedAt = saved.length ? new Date(Math.max(...saved.map((at) => at.getTime()))) : null;
  return {
    id: workout.id,
    name: workout.name,
    startedAt: workout.startedAt,
    autoFinishAt: workout.status === "active" ? strengthAutoFinishAt(workout.exercises, lastSavedAt)?.toISOString() ?? null : null,
    exercises: workout.exercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.exerciseNameRu,
      targetRestSeconds: exercise.targetRestSeconds,
      sets: exercise.sets.map(({ id, clientSetId, setIndex, weightKg, reps }) => ({
        id, clientSetId, setIndex, weightKg, reps,
      })),
    })),
  };
}
