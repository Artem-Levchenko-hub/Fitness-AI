import { and, asc, eq, inArray, lte, or } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { buildTrainerContext } from "@/lib/ai/context-builder";
import {
  generateTrainerResponse,
  TRAINER_MODEL,
  type TrainerResponse,
} from "@/lib/ai/gemini-structured";
import {
  DIGEST_SYSTEM_PROMPT,
  TRAINER_SYSTEM_PROMPT,
} from "@/lib/ai/prompts";
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
      .limit(BATCH_SIZE);

    if (pending.length === 0) return [];

    const ids = pending.map((j) => j.id);
    await tx
      .update(schema.aiJobs)
      .set({ status: "running", startedAt: new Date() })
      .where(inArray(schema.aiJobs.id, ids));

    return pending;
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
  const context = await buildTrainerContext(job.userId, job.workoutId, {
    kind: job.kind,
    circuitWorkoutId: job.circuitWorkoutId ?? null,
  });

  const systemPrompt =
    job.kind === "daily_digest"
      ? DIGEST_SYSTEM_PROMPT
      : TRAINER_SYSTEM_PROMPT;

  const result = await withCircuitBreaker(
    "gemini-trainer",
    () =>
      generateTrainerResponse({
        systemInstruction: systemPrompt,
        userPrompt: context.prompt,
        signal: AbortSignal.timeout(45_000),
      }),
    { threshold: 3, cooldownMs: 60_000 },
  );

  const md = renderMarkdown(result.json);

  const [analysis] = await db
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

  if (!analysis) throw new Error("Не удалось сохранить ai_analyses");
  return { analysisId: analysis.id, result: result.json };
}

function renderMarkdown(r: TrainerResponse): string {
  const lines: string[] = [
    `# Разбор тренировки (${r.overallScore}/100)`,
    "",
    `**${r.motivation}**`,
    "",
    `## Качество тренировки · ${r.trainingQuality.score}/100`,
    r.trainingQuality.comment,
    "",
    `## Восстановление (сон) · ${r.recoveryContext.score ?? "—"}`,
    r.recoveryContext.comment,
    "",
    `## Питание (КБЖУ) · ${r.nutritionContext.score ?? "—"}`,
    r.nutritionContext.comment,
    "",
    `## Что сделать в следующей сессии`,
    `_Фокус: ${r.nextSessionFocus}_`,
    "",
    ...r.recommendations.map((rec) => `- ${rec}`),
  ];
  if (r.missingDataAdvice) {
    lines.push("", "## Чтобы разбор был точнее", r.missingDataAdvice);
  }
  return lines.join("\n");
}

async function notifyTrainerReady(
  job: typeof schema.aiJobs.$inferSelect,
) {
  try {
    const subs = await getActiveForUser(job.userId);
    if (subs.length === 0) return;

    let url = "/dashboard";
    let tag = "trainer-generic";
    if (job.kind === "circuit_post_workout" && job.circuitWorkoutId) {
      url = `/circuits/${job.circuitWorkoutId}`;
      tag = `trainer-circuit-${job.circuitWorkoutId}`;
    } else if (job.workoutId) {
      url = `/workouts/${job.workoutId}/trainer`;
      tag = `trainer-${job.workoutId}`;
    } else if (job.kind === "daily_digest") {
      tag = "trainer-digest";
    }

    await sendPushToUser(job.userId, subs, {
      kind: "trainer_ready",
      title: "🏋️ Тренер разобрал тренировку",
      body: "Открой приложение, чтобы увидеть оценку и рекомендации.",
      url,
      tag,
    });
  } catch {
    /* push — необязательная фича, не валим job */
  }
}
