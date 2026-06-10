"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/require-user";
import {
  createSchedule,
  deleteSchedule,
  setScheduleEnabled,
  type SchedulePresetLink,
} from "@/lib/repos/schedule.repo";
import { scheduleSchema } from "@/server/schemas/schedule";

export type ScheduleState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

/** "template:abc" → {kind:"template", id:"abc"}. Формат уже провалидирован
 *  zod-регуляркой (kind ∈ template|circuit|cardio, id непустой). */
function parsePresetLink(
  raw: string | undefined,
): SchedulePresetLink | null {
  if (!raw) return null;
  const idx = raw.indexOf(":");
  const kind = raw.slice(0, idx) as SchedulePresetLink["kind"];
  return { kind, id: raw.slice(idx + 1) };
}

export async function createScheduleAction(
  _prev: ScheduleState,
  formData: FormData,
): Promise<ScheduleState> {
  const user = await requireUser();
  // daysOfWeek = несколько чекбоксов с name="days" → getAll, не fromEntries.
  const parsed = scheduleSchema.safeParse({
    label: formData.get("label"),
    hour: formData.get("hour"),
    daysOfWeek: formData.getAll("days"),
    // Native select шлёт "" для «свободное» — нормализуем в undefined.
    preset: formData.get("preset") || undefined,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Проверьте поля расписания",
    };
  }
  try {
    await createSchedule(user.id, {
      ...parsed.data,
      preset: parsePresetLink(parsed.data.preset),
    });
  } catch {
    return {
      status: "error",
      message: "Не удалось привязать заготовку — попробуйте ещё раз",
    };
  }
  revalidatePath("/schedule");
  return { status: "success" };
}

export async function deleteScheduleAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id"));
  if (!id) throw new Error("Missing id");
  await deleteSchedule(user.id, id);
  revalidatePath("/schedule");
}

export async function toggleScheduleAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id"));
  if (!id) throw new Error("Missing id");
  const enabled = formData.get("enabled") === "true";
  await setScheduleEnabled(user.id, id, enabled);
  revalidatePath("/schedule");
}
