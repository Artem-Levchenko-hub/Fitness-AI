import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { isFreshRecoveryDay } from "@/lib/domain/trainer/recovery-freshness";
import { getLatestMeasurement } from "@/lib/repos/body.repo";
import { listRecentNutrition } from "@/lib/repos/nutrition.repo";
import { listRecentSleep } from "@/lib/repos/sleep.repo";
import {
  assessTrainingReadiness,
  type TrainingReadiness,
} from "@/lib/domain/trainer/recovery-readiness";

/** Загружает только свежие сон/питание и последний вес для защитной адаптации. */
export async function getTrainingReadiness(userId: string): Promise<TrainingReadiness> {
  const [profile] = await db
    .select({ timezone: schema.users.timezone })
    .from(schema.users)
    .where(and(eq(schema.users.id, userId)))
    .limit(1);
  const timeZone = profile?.timezone ?? "Europe/Moscow";
  const [sleepRows, nutritionRows, measurement] = await Promise.all([
    // Берём две строки: локальное «сегодня» около UTC-полуночи может быть
    // новее серверного дня; если оно не подходит, вчерашняя всё ещё доступна.
    listRecentSleep(userId, 2),
    listRecentNutrition(userId, 2),
    getLatestMeasurement(userId),
  ]);
  const sleep = sleepRows.find((row) => isFreshRecoveryDay(row.date, timeZone));
  const nutrition = nutritionRows.find((row) =>
    isFreshRecoveryDay(row.date, timeZone),
  );

  return assessTrainingReadiness({
    sleepHours: sleep?.hours ?? null,
    sleepQuality: sleep?.quality ?? null,
    proteinG: nutrition?.proteinG ?? null,
    bodyWeightKg: measurement?.weightKg ?? null,
  });
}
