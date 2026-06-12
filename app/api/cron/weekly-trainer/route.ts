import { and, eq, gte } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  MIN_WEEKLY_SESSIONS,
  isWeeklyReviewWindow,
} from "@/lib/domain/schedule/weekly-trigger";
import { env } from "@/lib/env";
import { weeklyReviewData } from "@/lib/repos/stats.repo";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorize(req: Request): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** Дедуп: уже ставили weekly_review этому юзеру за последние 6 дней?
 *  6 < 7 — следующее воскресенье снова сработает, но в пределах одной недели
 *  повторный job не ставится (роут тикает ежечасно). */
const DEDUP_DAYS = 6;

/** Ежечасно: для юзеров, у кого локально воскресенье 20:00 — ставим
 *  `weekly_review` job по закрытии ISO-недели (она ещё «текущая» в этот час →
 *  воркер разберёт её как current). Условия: ≥2 завершённых силовых сессии за
 *  неделю И нет недавнего weekly_review job. Идемпотентно.
 *
 *  `?force=<userId>` (только с валидным CRON_SECRET) обходит ОКНО времени и
 *  ограничивает разбор ТОЛЬКО этим юзером — для end-to-end-проверки, сохраняя
 *  реальные гейты (≥2 сессии + дедуп). Без него прод-cron не трогает реальных
 *  юзеров вне их воскресного окна. */
export async function POST(req: Request) {
  if (!authorize(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const forceUserId = new URL(req.url).searchParams.get("force");
  const now = new Date();
  const dedupSince = new Date(now.getTime() - DEDUP_DAYS * 24 * 60 * 60 * 1000);

  const users = await db
    .select({ id: schema.users.id, timezone: schema.users.timezone })
    .from(schema.users);

  const queued: string[] = [];
  for (const u of users) {
    const tz = u.timezone || "Europe/Moscow";
    if (forceUserId) {
      if (u.id !== forceUserId) continue; // forced-режим: только целевой юзер
    } else if (!isWeeklyReviewWindow(now, tz)) {
      continue;
    }

    // Дешёвый гейт раньше тяжёлого: уже стоит недельный разбор?
    const [existing] = await db
      .select({ id: schema.aiJobs.id })
      .from(schema.aiJobs)
      .where(
        and(
          eq(schema.aiJobs.userId, u.id),
          eq(schema.aiJobs.kind, "weekly_review"),
          gte(schema.aiJobs.scheduledAt, dedupSince),
        ),
      )
      .limit(1);
    if (existing) continue;

    // ≥2 завершённых силовых на этой неделе — иначе разбирать нечего.
    const data = await weeklyReviewData(u.id, now, tz);
    if (data.current.sessions < MIN_WEEKLY_SESSIONS) continue;

    const [job] = await db
      .insert(schema.aiJobs)
      .values({
        userId: u.id,
        workoutId: null,
        kind: "weekly_review",
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
