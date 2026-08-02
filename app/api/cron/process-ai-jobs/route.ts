import { and, asc, desc, eq, inArray, lte, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { buildTrainerContext } from "@/lib/ai/context-builder";
import {
  claimAiCapacity,
  requireOwnedCircuitWorkout,
  requireOwnedWorkout,
  settleAiCapacity,
} from "@/lib/ai/guard";
import { adaptCircuitTemplateFromWorkout } from "@/lib/repos/circuit-templates.repo";
import {
  generateTrainerResponse,
  renderTrainerMarkdown,
  TRAINER_MODEL,
  trainerSchema,
  type TrainerResponse,
} from "@/lib/ai/trainer-structured";
import {
  DIGEST_SYSTEM_PROMPT,
  TRAINER_SYSTEM_PROMPT,
} from "@/lib/ai/prompts";
import { generateWeeklyReview } from "@/lib/ai/weekly-review-run";
import { getUserProfile } from "@/lib/repos/body.repo";
import { getActiveForUser } from "@/lib/repos/push.repo";
import { sendPushToUser } from "@/lib/push/vapid";
import {
  CircuitOpenError,
  withCircuitBreaker,
} from "@/lib/safety/circuit-breaker";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 5;

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

/** Подхватывает pending jobs, обрабатывает их батчем. Запускается:
 *  - cron-runner-ом раз в минуту;
 *  - fire-and-forget из server actions после создания job. */
export async function POST(req: Request) {
  if (!authorize(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const claimed = await db.transaction(async (tx) => {
    const pending = await tx
      .select()
      .from(schema.aiJobs)
      .where(
        and(
          or(
            eq(schema.aiJobs.status, "pending"),
            and(
              eq(schema.aiJobs.status, "failed"),
              lte(schema.aiJobs.attempts, MAX_ATTEMPTS - 1),
            ),
          ),
          lte(schema.aiJobs.scheduledAt, new Date()),
        ),
      )
      .orderBy(asc(schema.aiJobs.scheduledAt))
      .for("update", { skipLocked: true })
      .limit(BATCH_SIZE);

    if (pending.length === 0) return [];

    const ids = pending.map((j) => j.id);
    return tx
      .update(schema.aiJobs)
      .set({ status: "running", startedAt: new Date() })
      .where(inArray(schema.aiJobs.id, ids))
      .returning();
  });

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const job of claimed) {
    try {
      const result = await processJob(job);
      await db
        .update(schema.aiJobs)
        .set({
          status: "succeeded",
          finishedAt: new Date(),
          analysisId: result.analysisId,
          attempts: job.attempts + 1,
        })
        .where(eq(schema.aiJobs.id, job.id));
      results.push({ id: job.id, ok: true });
      void notifyTrainerReady(job);
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      const attempts = job.attempts + 1;
      const isOpen = err instanceof CircuitOpenError;
      const backoffMs = isOpen
        ? 60_000
        : attempts >= 3
          ? 60_000
          : attempts === 2
            ? 30_000
            : 10_000;
      await db
        .update(schema.aiJobs)
        .set({
          status: attempts >= MAX_ATTEMPTS && !isOpen ? "failed" : "pending",
          attempts,
          lastError: message,
          startedAt: null,
          scheduledAt: new Date(Date.now() + backoffMs),
        })
        .where(eq(schema.aiJobs.id, job.id));
      results.push({ id: job.id, ok: false, error: message });
    }
  }

  return Response.json({ processed: results.length, results });
}

export async function GET(req: Request) {
  return POST(req);
}

async function processJob(
  job: typeof schema.aiJobs.$inferSelect,
): Promise<{ analysisId: string; result: TrainerResponse }> {
  if (job.kind === "weekly_review") {
    return processWeeklyReview(job);
  }

  if (
    (job.workoutId && !(await requireOwnedWorkout(job.userId, job.workoutId))) ||
    (job.circuitWorkoutId &&
      !(await requireOwnedCircuitWorkout(job.userId, job.circuitWorkoutId)))
  ) {
    throw new Error("AI job target no longer belongs to its user");
  }

  // Идемпотентность: живой стрим (POST /api/ai/trainer/stream) генерит разбор
  // inline и сохраняет ai_analyses раньше, чем отложенный safety-net job
  // успевает стартовать. Если разбор по этой тренировке уже есть — НЕ
  // перегенерируем (нет двойного вызова LLM), просто привязываем существующий.
  const existing = await findExistingAnalysis(job);
  if (existing) {
    await maybeAdaptCircuitTemplate(job);
    return existing;
  }

  const capacity = await claimAiCapacity({
    userId: job.userId,
    operation:
      job.kind === "daily_digest" ? "daily_digest" : "post_workout_analysis",
    requestKey: `ai-job:${job.id}:${job.attempts + 1}`,
  });
  if (capacity.kind !== "allowed") {
    throw new Error(
      capacity.kind === "subscription_required"
        ? "Active Pro subscription is required for AI analysis"
        : capacity.kind === "quota_exceeded"
          ? capacity.message
          : "AI capacity temporarily unavailable",
    );
  }

  let context: Awaited<ReturnType<typeof buildTrainerContext>>;
  try {
    context = await buildTrainerContext(job.userId, job.workoutId, {
      kind: job.kind,
      circuitWorkoutId: job.circuitWorkoutId ?? null,
    });
  } catch (error) {
    await settleAiCapacity(capacity.usageId, false);
    throw error;
  }

  const systemPrompt =
    job.kind === "daily_digest"
      ? DIGEST_SYSTEM_PROMPT
      : TRAINER_SYSTEM_PROMPT;

  // RAG: retrieve канона по контексту тренировки.
  let canonContext = "";
  try {
    const { retrieveRelevant, formatRetrievedChunks } = await import("@/lib/ai/rag/retrieve");
    const chunks = await retrieveRelevant(context.prompt.slice(0, 1200), { topK: 4 });
    canonContext = formatRetrievedChunks(chunks);
  } catch (e) {
    console.error("[trainer-worker] RAG retrieve failed:", e);
    canonContext = "_(база знаний недоступна — отвечай только на основе цифр атлета и явно скажи об этом)_";
  }
  const userPromptWithCanon = `## Контекст из канона (загруженная литература)

${canonContext}

---

${context.prompt}`;

  let result: Awaited<ReturnType<typeof generateTrainerResponse>>;
  try {
    result = await withCircuitBreaker(
      "trainer-llm",
      () =>
        generateTrainerResponse({
          systemInstruction: systemPrompt,
          userPrompt: userPromptWithCanon,
          signal: AbortSignal.timeout(45_000),
        }),
      { threshold: 3, cooldownMs: 60_000 },
    );
  } catch (error) {
    await settleAiCapacity(capacity.usageId, false);
    throw error;
  }

  let md: string;
  try {
    md = renderTrainerMarkdown(result.json);
  } catch (error) {
    await settleAiCapacity(capacity.usageId, false);
    throw error;
  }

  let analysis: { id: string } | undefined;
  try {
    [analysis] = await db
      .insert(schema.aiAnalyses)
      .values({
        userId: job.userId,
        workoutId: job.workoutId,
        circuitWorkoutId: job.circuitWorkoutId ?? null,
        content: md,
        resultJson: result.json as object,
        modelVersion: result.modelVersion ?? TRAINER_MODEL,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
      })
      .returning({ id: schema.aiAnalyses.id });
  } catch (error) {
    await settleAiCapacity(capacity.usageId, false);
    throw error;
  }

  if (!analysis) {
    await settleAiCapacity(capacity.usageId, false);
    throw new Error("Не удалось сохранить ai_analyses");
  }
  await settleAiCapacity(capacity.usageId, true);
  await maybeAdaptCircuitTemplate(job);
  return { analysisId: analysis.id, result: result.json };
}

/** ПОСЛЕ анализа круговой тренер адаптирует шаблон-источник на месте под факт
 *  (повторы/время/вес, отдыхи, круги, изредка свап). Fail-soft (R-10): любая
 *  ошибка НЕ валит job (анализ уже сохранён). Идемпотентно в самом репо. */
async function maybeAdaptCircuitTemplate(
  job: typeof schema.aiJobs.$inferSelect,
): Promise<void> {
  if (job.kind !== "circuit_post_workout" || !job.circuitWorkoutId) return;
  try {
    const res = await adaptCircuitTemplateFromWorkout(
      job.userId,
      job.circuitWorkoutId,
    );
    if (res?.adapted) {
      revalidatePath("/templates");
      revalidatePath("/circuits");
      revalidatePath(`/circuits/${job.circuitWorkoutId}`);
    }
  } catch (e) {
    console.error("[circuit-adapt] failed:", e);
  }
}

/** Уже сохранённый разбор по этой тренировке (силовой/круговой) — для
 *  идемпотентности с живым стримом. null если нет / kind без привязки к
 *  тренировке / сохранённый JSON не проходит схему (тогда перегенерим). */
async function findExistingAnalysis(
  job: typeof schema.aiJobs.$inferSelect,
): Promise<{ analysisId: string; result: TrainerResponse } | null> {
  const match = job.workoutId
    ? eq(schema.aiAnalyses.workoutId, job.workoutId)
    : job.circuitWorkoutId
      ? eq(schema.aiAnalyses.circuitWorkoutId, job.circuitWorkoutId)
      : null;
  if (!match) return null;

  const [row] = await db
    .select({ id: schema.aiAnalyses.id, resultJson: schema.aiAnalyses.resultJson })
    .from(schema.aiAnalyses)
    .where(and(eq(schema.aiAnalyses.userId, job.userId), match))
    .orderBy(desc(schema.aiAnalyses.createdAt))
    .limit(1);

  if (!row?.resultJson) return null;
  const parsed = trainerSchema.safeParse(row.resultJson);
  if (!parsed.success) return null;
  return { analysisId: row.id, result: parsed.data };
}

/** H8.2 — авто-разбор недели по закрытии ISO-недели. Использует общее ядро
 *  `generateWeeklyReview` (тот же контракт, что кнопка «по запросу» H8.1):
 *  собирает агрегаты этой+прошлой недели, зовёт DeepSeek через breaker+timeout.
 *  Хранит как ai_analyses без workoutId (как daily_digest); kind разбора несёт
 *  ai_jobs.kind='weekly_review' → дисплей (H8.2c) находит через analysisId. */
async function processWeeklyReview(
  job: typeof schema.aiJobs.$inferSelect,
): Promise<{ analysisId: string; result: TrainerResponse }> {
  const profile = await getUserProfile(job.userId);
  const tz = profile?.timezone ?? "Europe/Moscow";

  const capacity = await claimAiCapacity({
    userId: job.userId,
    operation: "weekly_review",
    requestKey: `ai-job:${job.id}:${job.attempts + 1}`,
  });
  if (capacity.kind !== "allowed") {
    throw new Error(
      capacity.kind === "subscription_required"
        ? "Active Pro subscription is required for AI analysis"
        : capacity.kind === "quota_exceeded"
          ? capacity.message
          : "AI capacity temporarily unavailable",
    );
  }

  let result: Awaited<ReturnType<typeof generateWeeklyReview>>["result"];
  try {
    ({ result } = await generateWeeklyReview(job.userId, tz, new Date()));
  } catch (error) {
    await settleAiCapacity(capacity.usageId, false);
    throw error;
  }
  let md: string;
  try {
    md = renderTrainerMarkdown(result.json);
  } catch (error) {
    await settleAiCapacity(capacity.usageId, false);
    throw error;
  }

  let analysis: { id: string } | undefined;
  try {
    [analysis] = await db
      .insert(schema.aiAnalyses)
      .values({
        userId: job.userId,
        workoutId: null,
        circuitWorkoutId: null,
        content: md,
        resultJson: result.json as object,
        modelVersion: result.modelVersion ?? TRAINER_MODEL,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
      })
      .returning({ id: schema.aiAnalyses.id });
  } catch (error) {
    await settleAiCapacity(capacity.usageId, false);
    throw error;
  }

  if (!analysis) {
    await settleAiCapacity(capacity.usageId, false);
    throw new Error("Не удалось сохранить weekly review");
  }
  await settleAiCapacity(capacity.usageId, true);
  return { analysisId: analysis.id, result: result.json };
}

async function notifyTrainerReady(
  job: typeof schema.aiJobs.$inferSelect,
) {
  try {
    const subs = await getActiveForUser(job.userId);
    if (subs.length === 0) return;

    let url = "/dashboard";
    let tag = "trainer-generic";
    if (job.kind === "weekly_review") {
      url = "/stats";
      tag = "trainer-weekly";
    } else if (job.kind === "circuit_post_workout" && job.circuitWorkoutId) {
      url = `/circuits/${job.circuitWorkoutId}`;
      tag = `trainer-circuit-${job.circuitWorkoutId}`;
    } else if (job.workoutId) {
      url = `/workouts/${job.workoutId}/trainer`;
      tag = `trainer-${job.workoutId}`;
    } else if (job.kind === "daily_digest") {
      tag = "trainer-digest";
    }

    const isWeekly = job.kind === "weekly_review";
    await sendPushToUser(job.userId, subs, {
      kind: "trainer_ready",
      title: isWeekly
        ? "📅 Тренер разобрал твою неделю"
        : "🏋️ Тренер разобрал тренировку",
      body: isWeekly
        ? "Открой приложение, чтобы увидеть итог недели и фокус на следующую."
        : "Открой приложение, чтобы увидеть оценку и рекомендации.",
      url,
      tag,
    });
  } catch {
    /* push — необязательная фича, не валим job */
  }
}
