"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import {
  deleteQuickActivity,
  logQuickActivity,
} from "@/lib/repos/quick-activity.repo";

/** Пути, где доп. активность видна: тайл дашборда, графики/KPI /stats,
 *  нагрев аватара на /profile. */
const AFFECTED_PATHS = ["/dashboard", "/stats", "/profile"] as const;

const logSchema = z.object({
  exerciseId: z.string().min(1, "Выберите упражнение"),
  mode: z.enum(["sets", "myo_reps", "total"]),
  reps: z.coerce.number().int().min(1, "Повторы ≥ 1").max(10000),
  myoMiniSets: z.coerce.number().int().min(1).max(10).default(3),
  myoMiniReps: z.coerce.number().int().min(1).max(30).default(5),
  weightKg: z
    .union([z.coerce.number().min(0).max(500), z.null()])
    .transform((v) => (v === 0 ? null : v)),
});

export type QuickActivityActionState =
  | { status: "success"; message: string }
  | { status: "error"; message: string };

/** Записать доп. активность (типизированный вызов из клиента, без FormData —
 *  у шита две кнопки сохранения: «Сохранить» и «Ещё подход»). */
export async function logQuickActivityAction(input: {
  exerciseId: string;
  mode: "sets" | "myo_reps" | "total";
  reps: number;
  myoMiniSets?: number;
  myoMiniReps?: number;
  weightKg: number | null;
}): Promise<QuickActivityActionState> {
  const user = await requireUser();
  const parsed = logSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Проверьте поля",
    };
  }
  try {
    await logQuickActivity(user.id, parsed.data);
    for (const p of AFFECTED_PATHS) revalidatePath(p);
    return { status: "success", message: "Записано" };
  } catch {
    return { status: "error", message: "Не удалось сохранить — попробуйте ещё раз" };
  }
}

export async function deleteQuickActivityAction(
  id: string,
): Promise<QuickActivityActionState> {
  const user = await requireUser();
  if (!id) return { status: "error", message: "Нет id записи" };
  try {
    const existed = await deleteQuickActivity(user.id, id);
    if (existed) for (const p of AFFECTED_PATHS) revalidatePath(p);
    return { status: "success", message: "Удалено" };
  } catch {
    return { status: "error", message: "Не удалось удалить — попробуйте ещё раз" };
  }
}
