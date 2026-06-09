"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/require-user";
import {
  createSchedule,
  deleteSchedule,
  setScheduleEnabled,
} from "@/lib/repos/schedule.repo";
import { scheduleSchema } from "@/server/schemas/schedule";

export type ScheduleState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

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
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Проверьте поля расписания",
    };
  }
  await createSchedule(user.id, parsed.data);
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
