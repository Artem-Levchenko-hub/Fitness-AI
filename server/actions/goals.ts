"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { MUSCLE_KEYS } from "@/lib/domain/avatar/heat";
import {
  clearExerciseGoals,
  clearMuscleGroupGoals,
  createGoal,
} from "@/lib/repos/goals.repo";

/** H18.2 — постановка цели из карточки упражнения. На карточке упражнения
 *  доступны лишь измеримые по этому движению виды: рабочий вес и 1ПМ
 *  (частота — цель уровня группы/периода, не одного упражнения → не здесь). */
const setExerciseGoalSchema = z.object({
  exerciseId: z.string().min(1),
  kind: z.enum(["weight", "1rm"]),
  targetValue: z.coerce.number().positive().finite(),
});

export async function setExerciseGoalAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = setExerciseGoalSchema.safeParse({
    exerciseId: formData.get("exerciseId"),
    kind: formData.get("kind"),
    targetValue: formData.get("targetValue"),
  });
  if (!parsed.success) {
    // Невалидный ввод — тихо возвращаемся к карточке (R-10 fail-soft;
    // нативная форма уже валидирует number/required на клиенте).
    return;
  }

  const { exerciseId, kind, targetValue } = parsed.data;
  // Один активный таргет на упражнение: новая цель заменяет прежнюю.
  await clearExerciseGoals(user.id, exerciseId);
  await createGoal(user.id, { exerciseId, kind, targetValue });
  revalidatePath(`/exercises/${exerciseId}`);
}

export async function clearExerciseGoalAction(
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const exerciseId = String(formData.get("exerciseId") ?? "");
  if (!exerciseId) return;
  await clearExerciseGoals(user.id, exerciseId);
  revalidatePath(`/exercises/${exerciseId}`);
}

/** H18.2 — постановка цели из дрилла мышцы (панель аватара на /profile). На
 *  уровне группы измеримый вид — ЧАСТОТА (working-подходов в неделю); вес/1ПМ —
 *  это per-движение (карточка упражнения). Ключ группы валидируем против
 *  канонического MUSCLE_KEYS (= enum muscle_group_key) — чужой/битый ключ
 *  отсекается. */
const setMuscleGoalSchema = z.object({
  muscleGroupKey: z.enum(MUSCLE_KEYS),
  targetValue: z.coerce.number().int().positive().finite(),
});

export async function setMuscleGoalAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = setMuscleGoalSchema.safeParse({
    muscleGroupKey: formData.get("muscleGroupKey"),
    targetValue: formData.get("targetValue"),
  });
  if (!parsed.success) {
    // Невалидный ввод — тихо возвращаемся к /profile (R-10 fail-soft).
    return;
  }

  const { muscleGroupKey, targetValue } = parsed.data;
  // Один активный таргет на группу: новая цель заменяет прежнюю.
  await clearMuscleGroupGoals(user.id, muscleGroupKey);
  await createGoal(user.id, { muscleGroupKey, kind: "frequency", targetValue });
  revalidatePath("/profile");
}

export async function clearMuscleGoalAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = z
    .enum(MUSCLE_KEYS)
    .safeParse(formData.get("muscleGroupKey"));
  if (!parsed.success) return;
  await clearMuscleGroupGoals(user.id, parsed.data);
  revalidatePath("/profile");
}
