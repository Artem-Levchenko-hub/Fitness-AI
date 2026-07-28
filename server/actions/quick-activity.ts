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
  updateQuickActivity,
} from "@/lib/repos/quick-activity.repo";

/** Пути, где доп. активность видна: тайл дашборда, графики/KPI /stats,
 *  нагрев аватара на /profile. */
const AFFECTED_PATHS = ["/dashboard", "/stats", "/profile"] as const;

const logSchema = z.object({
  id: z.string().uuid().optional(),
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
  myoSets: z
    .array(
      z.object({
        role: z.enum(["activation", "mini"]),
        reps: z.coerce.number().int().min(1).max(100),
        weightKg: z.number().min(0).max(500).nullable(),
        restSeconds: z.number().int().min(0).max(300).nullable(),
      }),
    )
    .min(2)
    .max(11)
    .superRefine((sets, ctx) => {
      if (
        sets[0]?.role !== "activation" ||
        sets.slice(1).some((set) => set.role !== "mini")
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Сначала нужна активация, затем мини-подходы",
        });
      }
    })
    .nullable()
    .optional(),
});

export type QuickActivityActionState =
  | { status: "success"; message: string }
  | { status: "error"; message: string };

/** Записать доп. активность (типизированный вызов из клиента, без FormData —
 *  у шита две кнопки сохранения: «Сохранить» и «Ещё подход»). */
export async function logQuickActivityAction(input: {
  id?: string;
  exerciseId: string;
  mode: "sets" | "total" | "myo_reps";
  reps: number;
  weightKg: number | null;
  myoActivationReps?: number | null;
  myoMiniSets?: number | null;
  myoMiniReps?: number | null;
  myoRestSeconds?: number | null;
  myoFirstRestSeconds?: number | null;
  myoSets?: Array<{
    role: "activation" | "mini";
    reps: number;
    weightKg: number | null;
    restSeconds: number | null;
  }> | null;
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
    const { id, ...activity } = parsed.data;
    const structuredSets =
      activity.mode === "myo_reps" && activity.myoSets?.length
        ? activity.myoSets
        : null;
    const activationReps =
      structuredSets?.[0]?.reps ??
      activity.myoActivationReps ??
      activity.reps;
    const miniSets =
      structuredSets?.slice(1) ??
      Array.from(
        { length: activity.myoMiniSets ?? DEFAULT_MYO_MINI_SETS },
        () => ({
          reps:
            activity.myoMiniReps ??
            Math.max(
              1,
              Math.round(
                (activationReps * DEFAULT_MYO_REPS_PERCENT) / 100,
              ),
            ),
        }),
      );
    const payload =
      activity.mode === "myo_reps"
        ? {
            ...activity,
            myoActivationReps: activationReps,
            myoMiniSets: miniSets.length,
            myoMiniReps:
              structuredSets?.[1]?.reps ??
              activity.myoMiniReps ??
              miniSets[0]?.reps ??
              1,
            myoRestSeconds: activity.myoRestSeconds ?? DEFAULT_MYO_REST_SECONDS,
            myoFirstRestSeconds:
              activity.myoFirstRestSeconds ?? DEFAULT_MYO_FIRST_REST_SECONDS,
            reps: activationReps + miniSets.reduce((sum, set) => sum + set.reps, 0),
          }
        : activity;
    if (id) {
      const row = await updateQuickActivity(user.id, id, payload);
      if (!row) return { status: "error", message: "Запись не найдена" };
    } else {
      await logQuickActivity(user.id, payload);
    }
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
