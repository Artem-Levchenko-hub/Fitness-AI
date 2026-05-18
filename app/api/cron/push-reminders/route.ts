import { and, eq, gte, sql } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { sendPushToUser } from "@/lib/push/vapid";
import { getActiveForUser } from "@/lib/repos/push.repo";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** Локальный час юзера по его timezone. Возвращает 0..23. */
function localHour(now: Date, tz: string): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: tz,
    });
    const parts = fmt.formatToParts(now);
    const h = parts.find((p) => p.type === "hour")?.value ?? "0";
    return parseInt(h, 10) % 24;
  } catch {
    return now.getUTCHours();
  }
}

function localDateIso(now: Date, tz: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("sv-SE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: tz,
    });
    return fmt.format(now); // "YYYY-MM-DD"
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Раз в час: для каждого юзера проверяем локальное время и шлём
 *  напоминание (сон в 9:00, КБЖУ в 21:00) если запись за сегодня
 *  ещё не сделана. */
export async function POST(req: Request) {
  if (!authorize(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const users = await db
    .select({
      id: schema.users.id,
      timezone: schema.users.timezone,
    })
    .from(schema.users);

  let sleepSent = 0;
  let nutritionSent = 0;

  await Promise.all(
    users.map(async (u) => {
      const tz = u.timezone || "Europe/Moscow";
      const hour = localHour(now, tz);
      const localDate = localDateIso(now, tz);

      const subs = await getActiveForUser(u.id);
      if (subs.length === 0) return;

      // Сон: 9:00 локально
      if (hour === 9) {
        const [existing] = await db
          .select({ id: schema.sleepLogs.id })
          .from(schema.sleepLogs)
          .where(
            and(
              eq(schema.sleepLogs.userId, u.id),
              eq(schema.sleepLogs.date, localDate),
            ),
          )
          .limit(1);
        if (!existing && !(await alreadySentToday(u.id, "sleep_reminder", now))) {
          await sendPushToUser(u.id, subs, {
            kind: "sleep_reminder",
            title: "🌙 Сколько вы спали этой ночью?",
            body: "Запишите часы — тренер учтёт восстановление при разборе.",
            url: "/sleep",
            tag: "sleep-reminder",
          });
          sleepSent += 1;
        }
      }

      // КБЖУ: 21:00 локально
      if (hour === 21) {
        const [existing] = await db
          .select({ id: schema.nutritionEntries.id })
          .from(schema.nutritionEntries)
          .where(
            and(
              eq(schema.nutritionEntries.userId, u.id),
              eq(schema.nutritionEntries.date, localDate),
            ),
          )
          .limit(1);
        if (
          !existing &&
          !(await alreadySentToday(u.id, "nutrition_reminder", now))
        ) {
          await sendPushToUser(u.id, subs, {
            kind: "nutrition_reminder",
            title: "🍎 КБЖУ за день",
            body: "Запишите калории и белок — тренер увидит, как вы питаетесь.",
            url: "/nutrition",
            tag: "nutrition-reminder",
          });
          nutritionSent += 1;
        }
      }
    }),
  );

  return Response.json({
    ok: true,
    sleepSent,
    nutritionSent,
    totalUsers: users.length,
  });
}

export async function GET(req: Request) {
  return POST(req);
}

async function alreadySentToday(
  userId: string,
  kind: typeof schema.pushKind.enumValues[number],
  now: Date,
): Promise<boolean> {
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({ id: schema.notificationsLog.id })
    .from(schema.notificationsLog)
    .where(
      and(
        eq(schema.notificationsLog.userId, userId),
        eq(schema.notificationsLog.kind, kind),
        gte(schema.notificationsLog.sentAt, todayStart),
        sql`${schema.notificationsLog.deliveredCount} > 0`,
      ),
    )
    .limit(1);
  return !!row;
}
