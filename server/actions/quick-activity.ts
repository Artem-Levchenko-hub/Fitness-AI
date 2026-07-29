"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import {
  DEFAULT_MYO_REPS_PERCENT,
  DEFAULT_MYO_MINI_SETS,
  DEFAULT_MYO_FIRST_REST_SECONDS,
  DEFAULT_MYO_REST_SECONDS,
} from "@/lib/domain/workouts/myo-reps";
import {
  deleteQuickActivity,
  logQuickActivity,
} from "@/lib/repos/quick-activity.repo";

/** Пути, где доп. активность видна: тайл дашборда, графики/KPI /stats,
 *  нагрев аватара на /profile. */
const AFFECTED_PATHS = ["/dashboard", "/stats", "/profile"] as const;

const logSchema = z.object({
  exerciseId: z.string().min(1, "Выберите упражнение"),
  mode: z.enum(["sets", "total", "myo_reps"]),
  reps: z.coerce.number().int().min(1, "Повторы ≥ 1").max(10000),
  weightKg: z
    .union([z.coerce.number().min(0).max(500), z.null()])
    .transform((v) => (v === 0 ? null : v)),
  myoActivationReps: z.coerce.number().int().min(1).max(100).nullable().optional(),
  myoMiniSets: z.coerce.number().int().min(1).max(6).nullable().optional(),
  myoMiniReps: z.coerce.number().int().min(1).max(30).nullable().optional(),
  myoRestSeconds: z.coerce.number().int().min(10).max(90).nullable().optional(),
  myoFirstRestSeconds: z.coerce.number().int().min(10).max(90).nullable().optional(),
});

export type QuickActivityActionState =
  | { status: "success"; message: string }
  | { status: "error"; message: string };

/** Записать доп. активность (типизированный вызов из клиента, без FormData —
 *  у шита две кнопки сохранения: «Сохранить» и «Ещё подход»). */
export async function logQuickActivityAction(input: {
  exerciseId: string;
  mode: "sets" | "total" | "myo_reps";
  reps: number;
  weightKg: number | null;
  myoActivationReps?: number | null;
  myoMiniSets?: number | null;
  myoMiniReps?: number | null;
  myoRestSeconds?: number | null;
  myoFirstRestSeconds?: number | null;
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
    const payload =
      parsed.data.mode === "myo_reps"
        ? {
            ...parsed.data,
            myoActivationReps: parsed.data.myoActivationReps ?? parsed.data.reps,
            myoMiniSets: parsed.data.myoMiniSets ?? DEFAULT_MYO_MINI_SETS,
            myoMiniReps:
              parsed.data.myoMiniReps ??
              Math.max(
                1,
                Math.round(
                    ((parsed.data.myoActivationReps ?? parsed.data.reps) *
                    DEFAULT_MYO_REPS_PERCENT) /
                    100,
                ),
              ),
            myoRestSeconds: parsed.data.myoRestSeconds ?? DEFAULT_MYO_REST_SECONDS,
            myoFirstRestSeconds:
              parsed.data.myoFirstRestSeconds ?? DEFAULT_MYO_FIRST_REST_SECONDS,
            reps:
              (parsed.data.myoActivationReps ?? parsed.data.reps) +
              (parsed.data.myoMiniSets ?? DEFAULT_MYO_MINI_SETS) *
                (parsed.data.myoMiniReps ??
                  Math.max(
                    1,
                    Math.round(
                      ((parsed.data.myoActivationReps ?? parsed.data.reps) *
                        DEFAULT_MYO_REPS_PERCENT) /
                        100,
                    ),
                  )),
          }
        : parsed.data;
    await logQuickActivity(user.id, payload);
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
