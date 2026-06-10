"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { requireUser } from "@/lib/auth/require-user";
import {
  disableAnalysisSharing,
  enableAnalysisSharing,
} from "@/lib/repos/workouts.repo";

/** Создаёт aiJob (kind=on_demand) и возвращает jobId для поллинга. */
export async function requestTrainerOnDemand(workoutId: string | null) {
  const user = await requireUser();
  const [job] = await db
    .insert(schema.aiJobs)
    .values({
      userId: user.id,
      workoutId,
      kind: workoutId ? "on_demand" : "daily_digest",
      status: "pending",
    })
    .returning({ id: schema.aiJobs.id });
  if (!job) throw new Error("Не удалось создать задание");

  // Триггерим worker сразу (fire-and-forget).
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    void fetch(`${baseUrl}/api/cron/process-ai-jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CRON_SECRET ?? "dev"}`,
      },
    });
  } catch {
    /* подхватит cron */
  }

  revalidatePath("/dashboard");
  return { jobId: job.id };
}

/** Включить публичный шеринг разбора. R-7: repo фильтрует по userId.
 *  Возвращает capability-токен (для ссылки /a/{token}) либо null, если разбор
 *  не найден / не принадлежит юзеру. Идемпотентно (повтор → тот же токен). */
export async function enableAnalysisSharingAction(
  analysisId: string,
): Promise<{ token: string | null }> {
  const user = await requireUser();
  const token = await enableAnalysisSharing(user.id, analysisId);
  return { token };
}

/** Отключить публичный шеринг (сбросить токен). R-7: только свой разбор. */
export async function disableAnalysisSharingAction(
  analysisId: string,
): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const ok = await disableAnalysisSharing(user.id, analysisId);
  return { ok };
}
