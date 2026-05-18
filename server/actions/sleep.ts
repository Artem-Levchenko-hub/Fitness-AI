"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { deleteSleepForDate, upsertSleep } from "@/lib/repos/sleep.repo";

const upsertSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Неверная дата (YYYY-MM-DD)"),
  hours: z.coerce.number().min(0).max(24),
  quality: z
    .union([z.coerce.number().int().min(1).max(5), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v == null ? null : Number(v))),
  notes: z
    .string()
    .max(500)
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
});

export type SleepActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export async function upsertSleepAction(
  _prev: SleepActionState,
  formData: FormData,
): Promise<SleepActionState> {
  const user = await requireUser();
  const parsed = upsertSchema.safeParse({
    date: formData.get("date"),
    hours: formData.get("hours"),
    quality: formData.get("quality") ?? undefined,
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Проверьте поля",
    };
  }
  try {
    await upsertSleep(user.id, {
      date: parsed.data.date,
      hours: parsed.data.hours,
      quality: parsed.data.quality,
      notes: parsed.data.notes,
    });
    revalidatePath("/sleep");
    revalidatePath("/dashboard");
    return { status: "success", message: "Сохранено" };
  } catch (e) {
    return {
      status: "error",
      message: (e as Error).message ?? "Не удалось сохранить",
    };
  }
}

export async function deleteSleepAction(formData: FormData) {
  const user = await requireUser();
  const date = String(formData.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  await deleteSleepForDate(user.id, date);
  revalidatePath("/sleep");
  revalidatePath("/dashboard");
}
