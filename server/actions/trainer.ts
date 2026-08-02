"use server";

import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { requireUser } from "@/lib/auth/require-user";
import { requireOwnedCircuitWorkout, requireOwnedWorkout } from "@/lib/ai/guard";
import {
  disableAnalysisSharing,
  enableAnalysisSharing,
} from "@/lib/repos/workouts.repo";

/** Создаёт aiJob (kind=on_demand) и возвращает jobId для поллинга. */
export async function requestTrainerOnDemand(workoutId: string | null) {
  const user = await requireUser();
  if (workoutId && !(await requireOwnedWorkout(user.id, workoutId))) {
    throw new Error("Тренировка не найдена");
  }
  const kind = workoutId ? "on_demand" : "daily_digest";
  const [existing] = await db
    .select({ id: schema.aiJobs.id })
    .from(schema.aiJobs)
    .where(
      and(
        eq(schema.aiJobs.userId, user.id),
        eq(schema.aiJobs.kind, kind),
        workoutId ? eq(schema.aiJobs.workoutId, workoutId) : isNull(schema.aiJobs.workoutId),
        inArray(schema.aiJobs.status, ["pending", "running"]),
      ),
    )
    .limit(1);
  if (existing) return { jobId: existing.id };
  const [queued] = await db
    .select({ total: count() })
    .from(schema.aiJobs)
    .where(and(eq(schema.aiJobs.userId, user.id), inArray(schema.aiJobs.status, ["pending", "running"])));
  if ((queued?.total ?? 0) >= 3) throw new Error("Очередь AI занята. Подождите завершения текущих задач.");
  const [job] = await db
    .insert(schema.aiJobs)
    .values({
      userId: user.id,
      workoutId,
      kind,
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

/** Ручной перезапуск пост-тренировочного анализа, когда он «не запустился»:
 *  job упал терминально (failed, attempts ≥ 3 — воркер такие больше не берёт),
 *  застрял в running (воркер убит на середине — деплой/рестарт pm2), или job
 *  вообще не был создан (finish оборвался до вставки). Сбрасывает существующий
 *  job в pending с attempts=0 (воркер подхватит) либо создаёт новый, и сразу
 *  дёргает воркер fire-and-forget. Идемпотентно к готовому разбору: если
 *  ai_analyses уже есть — ничего не перезапускаем (processJob и сам привязал бы
 *  существующий через findExistingAnalysis).
 *
 *  Свежий running (startedAt < 3 мин назад) НЕ сбрасываем — он реально
 *  работает; сброс породил бы параллельную генерацию. */
export async function retryAnalysisAction(input: {
  workoutId?: string;
  circuitWorkoutId?: string;
}): Promise<
  | { status: "exists" | "queued" | "already_running"; jobId?: string }
  | { status: "error"; message: string }
> {
  const user = await requireUser();
  const workoutId = input.workoutId ?? null;
  const circuitWorkoutId = input.circuitWorkoutId ?? null;
  if (!workoutId && !circuitWorkoutId) {
    return { status: "error", message: "Нет id тренировки" };
  }
  if (workoutId && !(await requireOwnedWorkout(user.id, workoutId))) {
    return { status: "error", message: "Тренировка не найдена" };
  }
  if (circuitWorkoutId && !(await requireOwnedCircuitWorkout(user.id, circuitWorkoutId))) {
    return { status: "error", message: "Круговая тренировка не найдена" };
  }

  const kind = circuitWorkoutId ? "circuit_post_workout" : "post_workout";
  const targetMatch = circuitWorkoutId
    ? eq(schema.aiJobs.circuitWorkoutId, circuitWorkoutId)
    : eq(schema.aiJobs.workoutId, workoutId!);
  const revalidate = () =>
    revalidatePath(
      circuitWorkoutId
        ? `/circuits/${circuitWorkoutId}`
        : `/workouts/${workoutId}/trainer`,
    );

  // Разбор уже есть → перезапуск не нужен (страница покажет его после refresh).
  const analysisMatch = circuitWorkoutId
    ? eq(schema.aiAnalyses.circuitWorkoutId, circuitWorkoutId)
    : eq(schema.aiAnalyses.workoutId, workoutId!);
  const [existingAnalysis] = await db
    .select({ id: schema.aiAnalyses.id })
    .from(schema.aiAnalyses)
    .where(and(eq(schema.aiAnalyses.userId, user.id), analysisMatch))
    .limit(1);
  if (existingAnalysis) {
    revalidate();
    return { status: "exists" };
  }

  const [job] = await db
    .select({
      id: schema.aiJobs.id,
      status: schema.aiJobs.status,
      startedAt: schema.aiJobs.startedAt,
    })
    .from(schema.aiJobs)
    .where(
      and(
        eq(schema.aiJobs.userId, user.id),
        eq(schema.aiJobs.kind, kind),
        targetMatch,
      ),
    )
    .orderBy(desc(schema.aiJobs.scheduledAt))
    .limit(1);

  let jobId: string;
  if (job) {
    const freshRunning =
      job.status === "running" &&
      job.startedAt != null &&
      Date.now() - job.startedAt.getTime() < 3 * 60_000;
    if (freshRunning) {
      return { status: "already_running", jobId: job.id };
    }
    await db
      .update(schema.aiJobs)
      .set({
        status: "pending",
        attempts: 0,
        lastError: null,
        analysisId: null,
        startedAt: null,
        finishedAt: null,
        scheduledAt: new Date(),
      })
      .where(eq(schema.aiJobs.id, job.id));
    jobId = job.id;
  } else {
    const [created] = await db
      .insert(schema.aiJobs)
      .values({
        userId: user.id,
        workoutId,
        circuitWorkoutId,
        kind,
        status: "pending",
      })
      .returning({ id: schema.aiJobs.id });
    if (!created) return { status: "error", message: "Не удалось создать задание" };
    jobId = created.id;
  }

  // Триггерим воркер сразу (fire-and-forget) — как requestTrainerOnDemand.
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
    /* подхватит cron в течение минуты */
  }

  revalidate();
  return { status: "queued", jobId };
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
