import { z } from "zod";

import { and, count, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { requireUser } from "@/lib/auth/require-user";
import { requireOwnedWorkout } from "@/lib/ai/guard";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

function triggerWorker(): void {
  if (!env.CRON_SECRET) return;
  try {
    void fetch(`${env.NEXT_PUBLIC_APP_URL}/api/cron/process-ai-jobs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    });
  } catch {
    /* пусто */
  }
}

const bodySchema = z.object({
  workoutId: z.string().uuid().optional(),
  circuitWorkoutId: z.string().uuid().optional(),
  // Автоматические виды создаёт только trusted cron/server action. Публичный
  // endpoint не должен позволять забивать общую очередь digest-ами.
  kind: z.literal("on_demand").default("on_demand"),
});

/** Создаёт aiJob и возвращает jobId. Реальный вызов Gemini делает worker
 *  (/api/cron/process-ai-jobs), фронт поллит /api/ai/jobs/[id]. */
export async function POST(request: Request) {
  const user = await requireUser();

  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!parsed.workoutId || parsed.circuitWorkoutId) {
    return Response.json(
      { error: "workoutId required; circuit and scheduled kinds are not public" },
      { status: 400 },
    );
  }
  if (!(await requireOwnedWorkout(user.id, parsed.workoutId))) {
    return Response.json({ error: "workout_not_found" }, { status: 404 });
  }

  const [existing] = await db
    .select({ id: schema.aiJobs.id })
    .from(schema.aiJobs)
    .where(and(eq(schema.aiJobs.userId, user.id), eq(schema.aiJobs.kind, "on_demand"), eq(schema.aiJobs.workoutId, parsed.workoutId), inArray(schema.aiJobs.status, ["pending", "running"])))
    .limit(1);
  if (existing) return Response.json({ jobId: existing.id, status: "pending", deduplicated: true });
  const [queued] = await db
    .select({ total: count() })
    .from(schema.aiJobs)
    .where(and(eq(schema.aiJobs.userId, user.id), inArray(schema.aiJobs.status, ["pending", "running"])));
  if ((queued?.total ?? 0) >= 3) {
    return Response.json({ error: "ai_queue_full" }, { status: 429 });
  }

  const [job] = await db
    .insert(schema.aiJobs)
    .values({
      userId: user.id,
      workoutId: parsed.workoutId ?? null,
      circuitWorkoutId: null,
      kind: parsed.kind,
      status: "pending",
    })
    .returning({ id: schema.aiJobs.id });

  if (!job) {
    return Response.json({ error: "Failed to create job" }, { status: 500 });
  }

  triggerWorker();

  return Response.json({ jobId: job.id, status: "pending" });
}
