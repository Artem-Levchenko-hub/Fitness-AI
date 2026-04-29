"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import {
  deleteSet,
  finishWorkout,
  recordSet,
  startWorkoutFromTemplate,
} from "@/lib/repos/workouts.repo";

const startSchema = z.object({
  templateId: z.string().uuid(),
});

export async function startWorkoutFromTemplateAction(formData: FormData) {
  const user = await requireUser();
  const parsed = startSchema.safeParse({
    templateId: formData.get("templateId"),
  });
  if (!parsed.success) throw new Error("Invalid templateId");

  const { id } = await startWorkoutFromTemplate(user.id, parsed.data.templateId);
  revalidatePath("/dashboard");
  revalidatePath("/workouts");
  redirect(`/workouts/${id}`);
}

const recordSetSchema = z.object({
  workoutId: z.string().uuid(),
  workoutExerciseId: z.string().uuid(),
  setIndex: z.coerce.number().int().min(0).max(50),
  weightKg: z.coerce.number().min(0).max(1000),
  reps: z.coerce.number().int().min(1).max(100),
  rpe: z
    .union([z.coerce.number().min(1).max(10), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v == null ? null : Number(v))),
  restSeconds: z
    .union([z.coerce.number().int().min(0).max(3600), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v == null ? null : Number(v))),
});

export type RecordSetState =
  | { status: "idle" }
  | { status: "error"; message: string };

export async function recordSetAction(
  _prev: RecordSetState,
  formData: FormData,
): Promise<RecordSetState> {
  const user = await requireUser();
  const parsed = recordSetSchema.safeParse({
    workoutId: formData.get("workoutId"),
    workoutExerciseId: formData.get("workoutExerciseId"),
    setIndex: formData.get("setIndex"),
    weightKg: formData.get("weightKg"),
    reps: formData.get("reps"),
    rpe: formData.get("rpe") ?? undefined,
    restSeconds: formData.get("restSeconds") ?? undefined,
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      status: "error",
      message: first?.message ?? "Проверьте поля подхода",
    };
  }

  await recordSet(user.id, parsed.data.workoutId, {
    workoutExerciseId: parsed.data.workoutExerciseId,
    setIndex: parsed.data.setIndex,
    weightKg: parsed.data.weightKg,
    reps: parsed.data.reps,
    rpe: parsed.data.rpe,
    restSeconds: parsed.data.restSeconds,
  });
  revalidatePath(`/workouts/${parsed.data.workoutId}`);
  return { status: "idle" };
}

const deleteSetSchema = z.object({
  workoutId: z.string().uuid(),
  setId: z.string().uuid(),
});

export async function deleteSetAction(formData: FormData) {
  const user = await requireUser();
  const parsed = deleteSetSchema.safeParse({
    workoutId: formData.get("workoutId"),
    setId: formData.get("setId"),
  });
  if (!parsed.success) throw new Error("Invalid set/workout id");
  await deleteSet(user.id, parsed.data.workoutId, parsed.data.setId);
  revalidatePath(`/workouts/${parsed.data.workoutId}`);
}

export async function finishWorkoutAction(formData: FormData) {
  const user = await requireUser();
  const workoutId = String(formData.get("workoutId"));
  if (!workoutId) throw new Error("Missing workoutId");
  await finishWorkout(user.id, workoutId);
  revalidatePath(`/workouts/${workoutId}`);
  revalidatePath("/workouts");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
