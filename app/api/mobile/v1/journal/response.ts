import type { ActiveWorkout } from "@/lib/repos/workouts.repo";

export function journalJson(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function serializeJournalWorkout(workout: ActiveWorkout) {
  return {
    id: workout.id,
    name: workout.name,
    startedAt: workout.startedAt,
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
