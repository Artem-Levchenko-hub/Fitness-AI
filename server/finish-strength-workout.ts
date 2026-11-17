import { revalidatePath } from "next/cache";

import { getTrainingReadiness } from "@/lib/repos/recovery.repo";
import { adaptTemplateAfterWorkout } from "@/lib/repos/training-programs.repo";
import { finishWorkout, getActiveWorkoutForUser, type WorkoutFinishNote } from "@/lib/repos/workouts.repo";

/** Завершение с сайта и из приложения использует одну очередь анализа и адаптацию шаблона. */
export async function finishStrengthWorkout(
  userId: string,
  workoutId: string,
  note?: WorkoutFinishNote,
) {
  const transition = await finishWorkout(userId, workoutId, note);
  if (transition !== "changed") return transition;

  try {
    const done = await getActiveWorkoutForUser(userId, workoutId);
    if (done?.status === "completed") {
      const performed = done.exercises.map(({ exerciseId, sets }) => ({ exerciseId, sets }));
      const readiness = await getTrainingReadiness(userId);
      if (await adaptTemplateAfterWorkout(userId, workoutId, performed, readiness)) {
        revalidatePath("/programs");
        revalidatePath("/templates");
      }
    }
  } catch (error) {
    console.error("[template-adapt] adaptation failed:", error);
  }

  revalidatePath(`/workouts/${workoutId}`);
  revalidatePath("/workouts");
  revalidatePath("/dashboard");
  return transition;
}
