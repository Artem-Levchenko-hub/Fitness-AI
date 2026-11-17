"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/require-user";
import {
  deleteNutritionForDate,
  upsertNutrition,
} from "@/lib/repos/nutrition.repo";
import { nutritionEntrySchema } from "@/server/schemas/wellness";

export type NutritionActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export async function upsertNutritionAction(
  _prev: NutritionActionState,
  formData: FormData,
): Promise<NutritionActionState> {
  const user = await requireUser();
  const parsed = nutritionEntrySchema.safeParse({
    date: formData.get("date"),
    kcal: formData.get("kcal") ?? undefined,
    proteinG: formData.get("proteinG") ?? undefined,
    fatG: formData.get("fatG") ?? undefined,
    carbsG: formData.get("carbsG") ?? undefined,
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Проверьте поля",
    };
  }
  try {
    await upsertNutrition(user.id, {
      date: parsed.data.date,
      kcal: parsed.data.kcal,
      proteinG: parsed.data.proteinG,
      fatG: parsed.data.fatG,
      carbsG: parsed.data.carbsG,
      notes: parsed.data.notes,
    });
    revalidatePath("/nutrition");
    revalidatePath("/dashboard");
    return { status: "success", message: "Сохранено" };
  } catch (e) {
    return {
      status: "error",
      message: (e as Error).message ?? "Не удалось сохранить",
    };
  }
}

export async function deleteNutritionAction(formData: FormData) {
  const user = await requireUser();
  const date = String(formData.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  await deleteNutritionForDate(user.id, date);
  revalidatePath("/nutrition");
  revalidatePath("/dashboard");
}
