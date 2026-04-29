"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import {
  createCustomExercise,
  deleteCustomExercise,
  updateCustomExercise,
  type ExerciseInput,
} from "@/lib/repos/exercises.repo";
import { exerciseInputSchema } from "@/server/schemas/exercises";

export type ExerciseActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "success" };

function parseFormData(formData: FormData) {
  const primary = formData.getAll("primary").map(String);
  const secondary = formData.getAll("secondary").map(String);
  const parsed = exerciseInputSchema.safeParse({
    nameRu: formData.get("nameRu"),
    nameEn: formData.get("nameEn"),
    description: formData.get("description") ?? undefined,
    primary,
    secondary,
  });
  return parsed;
}

export async function createCustomExerciseAction(
  _prev: ExerciseActionState,
  formData: FormData,
): Promise<ExerciseActionState> {
  const user = await requireUser();
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      status: "error",
      message: first?.message ?? "Проверьте поля формы",
    };
  }

  await createCustomExercise(user.id, parsed.data as ExerciseInput);
  revalidatePath("/exercises");
  redirect("/exercises");
}

export async function updateCustomExerciseAction(
  exerciseId: string,
  _prev: ExerciseActionState,
  formData: FormData,
): Promise<ExerciseActionState> {
  const user = await requireUser();
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      status: "error",
      message: first?.message ?? "Проверьте поля формы",
    };
  }

  await updateCustomExercise(user.id, exerciseId, parsed.data as ExerciseInput);
  revalidatePath("/exercises");
  revalidatePath(`/exercises/${exerciseId}`);
  redirect(`/exercises/${exerciseId}`);
}

export async function deleteCustomExerciseAction(formData: FormData) {
  const user = await requireUser();
  const exerciseId = String(formData.get("exerciseId"));
  if (!exerciseId) throw new Error("Missing exerciseId");
  await deleteCustomExercise(user.id, exerciseId);
  revalidatePath("/exercises");
  redirect("/exercises");
}
