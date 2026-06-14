"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { clearExerciseGoals, createGoal } from "@/lib/repos/goals.repo";

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
