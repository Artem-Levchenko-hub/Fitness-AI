import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { requireUser } from "@/lib/auth/require-user";

export const runtime = "nodejs";

/** GET /api/ai/jobs/:id — клиент поллит до status=succeeded|failed. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await ctx.params;

  const [job] = await db
    .select()
    .from(schema.aiJobs)
    .where(and(eq(schema.aiJobs.id, id), eq(schema.aiJobs.userId, user.id)))
    .limit(1);

  if (!job) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  let analysis = null;
  if (job.analysisId) {
    const [a] = await db
      .select()
      .from(schema.aiAnalyses)
      .where(eq(schema.aiAnalyses.id, job.analysisId))
      .limit(1);
    analysis = a ?? null;
  }

  return Response.json({
    id: job.id,
    status: job.status,
    kind: job.kind,
    workoutId: job.workoutId,
    attempts: job.attempts,
    lastError: job.lastError,
    analysis: analysis
      ? {
          id: analysis.id,
          content: analysis.content,
          resultJson: analysis.resultJson,
          modelVersion: analysis.modelVersion,
          createdAt: analysis.createdAt,
        }
      : null,
  });
}
