"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/require-user";
import { morningContext } from "@/lib/domain/wellness/morning";
import { getUserProfile } from "@/lib/repos/body.repo";
import { getNutritionForDate } from "@/lib/repos/nutrition.repo";
import { getSleepForDate } from "@/lib/repos/sleep.repo";
import { saveMorningWellness } from "@/lib/repos/wellness.repo";
import { morningWellnessSchema } from "@/server/schemas/morning-wellness";

export type MorningWellnessStatus = {
  date: string;
  proteinDate: string;
  timeZone: string;
  sleepRecorded: boolean;
  proteinRecorded: boolean;
};

export async function getMorningWellnessStatus(): Promise<MorningWellnessStatus | null> {
  const user = await requireUser();
  const profile = await getUserProfile(user.id);
  const timeZone = profile?.timezone ?? "Europe/Moscow";
  const context = morningContext(new Date(), timeZone);
  if (!context.isMorning) return null;
  const [sleep, nutrition] = await Promise.all([
    getSleepForDate(user.id, context.date),
    getNutritionForDate(user.id, context.proteinDate),
  ]);
  return {
    date: context.date, proteinDate: context.proteinDate, timeZone,
    sleepRecorded: sleep !== null, proteinRecorded: nutrition?.proteinG != null,
  };
}

export type MorningWellnessResult = { status: "success" } | { status: "error"; message: string };

export async function saveMorningWellnessAction(formData: FormData): Promise<MorningWellnessResult> {
  const user = await requireUser();
  const parsed = morningWellnessSchema.safeParse({
    date: formData.get("date"), hours: formData.get("hours") ?? undefined,
    proteinG: formData.get("proteinG") ?? undefined,
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Проверьте поля" };
  const profile = await getUserProfile(user.id);
  const context = morningContext(new Date(), profile?.timezone ?? "Europe/Moscow");
  if (context.date !== parsed.data.date) {
    return { status: "error", message: "Наступил новый день. Закройте окно и запишите данные в разделах «Сон» и «Питание»." };
  }
  try {
    await saveMorningWellness(user.id, {
      date: context.date, proteinDate: context.proteinDate,
      hours: parsed.data.hours, proteinG: parsed.data.proteinG,
    });
    for (const path of ["/dashboard", "/stats", "/sleep", "/nutrition"]) revalidatePath(path);
    return { status: "success" };
  } catch {
    return { status: "error", message: "Не удалось сохранить. Проверьте соединение и попробуйте ещё раз." };
  }
}
