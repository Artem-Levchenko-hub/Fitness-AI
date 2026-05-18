import { and, eq, gte } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorize(req: Request): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function localHour(now: Date, tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: tz,
    }).formatToParts(now);
    return parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10) % 24;
  } catch {
    return now.getUTCHours();
  }
}

/** Раз в час: для юзеров, у кого локально 22:00 — ставим daily_digest job.
 *  Idempotency: не ставим повторный digest если за последние 23 часа уже был
 *  pending/running/succeeded digest для этого юзера. */
export async function POST(req: Request) {
  if (!authorize(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const dedupSince = new Date(now.getTime() - 23 * 60 * 60 * 1000);

  const users = await db
    .select({ id: schema.users.id, timezone: schema.users.timezone })
    .from(schema.users);

  const queued: string[] = [];
  for (const u of users) {
    const tz = u.timezone || "Europe/Moscow";
    if (localHour(now, tz) !== 22) continue;

    const [existing] = await db
      .select({ id: schema.aiJobs.id })
      .from(schema.aiJobs)
      .where(
        and(
          eq(schema.aiJobs.userId, u.id),
          eq(schema.aiJobs.kind, "daily_digest"),
          gte(schema.aiJobs.scheduledAt, dedupSince),
        ),
      )
      .limit(1);
    if (existing) continue;

    const [job] = await db
      .insert(schema.aiJobs)
      .values({
        userId: u.id,
        workoutId: null,
        kind: "daily_digest",
        status: "pending",
      })
      .returning({ id: schema.aiJobs.id });
    if (job) queued.push(job.id);
  }

  if (queued.length > 0 && env.CRON_SECRET) {
    try {
      void fetch(`${env.NEXT_PUBLIC_APP_URL}/api/cron/process-ai-jobs`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      });
    } catch {
      /* воркер подхватит при следующем тике */
    }
  }

  return Response.json({ ok: true, queued: queued.length });
}

export async function GET(req: Request) {
  return POST(req);
}
