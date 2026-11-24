import { and, count, eq, isNotNull, lte } from "drizzle-orm";

import { db } from "@/db/client";
import { nutritionEntries, sleepLogs } from "@/db/schema";
import { upsertNutritionProtein } from "@/lib/repos/nutrition.repo";
import { upsertSleepHours } from "@/lib/repos/sleep.repo";

export async function saveMorningWellness(
  userId: string,
  input: { date: string; proteinDate: string; hours?: number; proteinG?: number },
): Promise<void> {
  await db.transaction(async (tx) => {
    if (input.hours !== undefined) await upsertSleepHours(userId, input.date, input.hours, tx);
    if (input.proteinG !== undefined) await upsertNutritionProtein(userId, input.proteinDate, input.proteinG, tx);
  });
}

export async function getWellnessLoggedDays(userId: string, toDate: string) {
  const [[sleep], [nutrition]] = await Promise.all([
    db.select({ days: count() }).from(sleepLogs).where(and(
      eq(sleepLogs.userId, userId), lte(sleepLogs.date, toDate),
    )),
    db.select({ days: count() }).from(nutritionEntries).where(and(
      eq(nutritionEntries.userId, userId), lte(nutritionEntries.date, toDate),
      isNotNull(nutritionEntries.proteinG),
    )),
  ]);
  return { sleepDays: Number(sleep?.days ?? 0), proteinDays: Number(nutrition?.days ?? 0) };
}
