import { z } from "zod";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { requireUser } from "@/lib/auth/require-user";
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
  kind: z
    .enum([
      "post_workout",
      "daily_digest",
      "on_demand",
      "circuit_post_workout",
    ])
    .default("on_demand"),
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

  if (
    parsed.kind === "post_workout" ||
    parsed.kind === "on_demand"
  ) {
    if (!parsed.workoutId) {
      return Response.json(
        { error: "workoutId required for post_workout / on_demand" },
        { status: 400 },
      );
    }
  }

  if (parsed.kind === "circuit_post_workout" && !parsed.circuitWorkoutId) {
    return Response.json(
      { error: "circuitWorkoutId required for circuit_post_workout" },
      { status: 400 },
    );
  }

  const [job] = await db
    .insert(schema.aiJobs)
    .values({
      userId: user.id,
      workoutId: parsed.workoutId ?? null,
      circuitWorkoutId: parsed.circuitWorkoutId ?? null,
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
