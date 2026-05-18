import { and, between, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import type { NewSleepLog, SleepLog } from "@/db/schema";

/** Получить запись о сне за конкретную дату (ISO yyyy-mm-dd). */
export async function getSleepForDate(
  userId: string,
  isoDate: string,
): Promise<SleepLog | null> {
  const [row] = await db
    .select()
    .from(schema.sleepLogs)
    .where(
      and(
        eq(schema.sleepLogs.userId, userId),
        eq(schema.sleepLogs.date, isoDate),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Получить N последних записей о сне (по убыванию даты). */
export async function listRecentSleep(
  userId: string,
  limit = 14,
): Promise<SleepLog[]> {
  return db
    .select()
    .from(schema.sleepLogs)
    .where(eq(schema.sleepLogs.userId, userId))
    .orderBy(desc(schema.sleepLogs.date))
    .limit(limit);
}

/** Получить записи в диапазоне дат (включительно). */
export async function getSleepRange(
  userId: string,
  fromIso: string,
  toIso: string,
): Promise<SleepLog[]> {
  return db
    .select()
    .from(schema.sleepLogs)
    .where(
      and(
        eq(schema.sleepLogs.userId, userId),
        between(schema.sleepLogs.date, fromIso, toIso),
      ),
    )
    .orderBy(desc(schema.sleepLogs.date));
}

/** Upsert: одна запись на (userId, date). */
export async function upsertSleep(
  userId: string,
  input: Omit<NewSleepLog, "userId" | "id"> & { id?: string },
): Promise<SleepLog> {
  const [row] = await db
    .insert(schema.sleepLogs)
    .values({ ...input, userId })
    .onConflictDoUpdate({
      target: [schema.sleepLogs.userId, schema.sleepLogs.date],
      set: {
        hours: input.hours,
        quality: input.quality ?? null,
        notes: input.notes ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!row) throw new Error("upsertSleep вернул пустой результат");
  return row;
}

export async function deleteSleepForDate(
  userId: string,
  isoDate: string,
): Promise<void> {
  await db
    .delete(schema.sleepLogs)
    .where(
      and(
        eq(schema.sleepLogs.userId, userId),
        eq(schema.sleepLogs.date, isoDate),
      ),
    );
}
