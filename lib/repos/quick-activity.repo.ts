import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import type { QuickActivity } from "@/db/schema";
import type { QuickMyoSet } from "@/db/schema";

/** Доп. активность (быстрый лог вне тренировки) — CRUD. DAL: каждая функция
 *  принимает userId и фильтрует по нему (нет RLS — защищаемся сами, R-7).
 *  Агрегаты для /stats, аватара и недельного разбора живут в stats.repo
 *  (третий источник рядом с силовыми и круговыми). */

export type LogQuickActivityInput = {
  exerciseId: string;
  mode: "sets" | "total" | "myo_reps";
  reps: number;
  weightKg: number | null;
  myoActivationReps?: number | null;
  myoMiniSets?: number | null;
  myoMiniReps?: number | null;
  myoRestSeconds?: number | null;
  myoFirstRestSeconds?: number | null;
  myoSets?: QuickMyoSet[] | null;
};

export async function logQuickActivity(
  userId: string,
  input: LogQuickActivityInput,
): Promise<QuickActivity> {
  const [row] = await db
    .insert(schema.quickActivities)
    .values({ ...input, userId })
    .returning();
  if (!row) throw new Error("logQuickActivity вернул пустой результат");
  return row;
}

export async function updateQuickActivity(
  userId: string,
  id: string,
  input: LogQuickActivityInput,
): Promise<QuickActivity | null> {
  const [row] = await db
    .update(schema.quickActivities)
    .set(input)
    .where(
      and(
        eq(schema.quickActivities.id, id),
        eq(schema.quickActivities.userId, userId),
      ),
    )
    .returning();
  return row ?? null;
}

/** Удаление своей записи. Возвращает true, если строка существовала. */
export async function deleteQuickActivity(
  userId: string,
  id: string,
): Promise<boolean> {
  const rows = await db
    .delete(schema.quickActivities)
    .where(
      and(
        eq(schema.quickActivities.id, id),
        eq(schema.quickActivities.userId, userId),
      ),
    )
    .returning({ id: schema.quickActivities.id });
  return rows.length > 0;
}

export type QuickActivityEntry = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  mode: "sets" | "total" | "myo_reps";
  reps: number;
  weightKg: number | null;
  myoActivationReps: number | null;
  myoMiniSets: number | null;
  myoMiniReps: number | null;
  myoRestSeconds: number | null;
  myoFirstRestSeconds: number | null;
  myoSets: QuickMyoSet[] | null;
  performedAt: Date;
};

/** Записи за календарный день `dayIso` (YYYY-MM-DD) в TZ юзера — для списка
 *  «сегодня» в тайле/шите. День бакетится как везде (G1). */
export async function listQuickActivityForDay(
  userId: string,
  dayIso: string,
  timeZone: string,
): Promise<QuickActivityEntry[]> {
  const dayExpr = sql<string>`to_char(${schema.quickActivities.performedAt} AT TIME ZONE ${timeZone}, 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      id: schema.quickActivities.id,
      exerciseId: schema.quickActivities.exerciseId,
      exerciseName: schema.exercises.nameRu,
      mode: schema.quickActivities.mode,
      reps: schema.quickActivities.reps,
      weightKg: schema.quickActivities.weightKg,
      myoActivationReps: schema.quickActivities.myoActivationReps,
      myoMiniSets: schema.quickActivities.myoMiniSets,
      myoMiniReps: schema.quickActivities.myoMiniReps,
      myoRestSeconds: schema.quickActivities.myoRestSeconds,
      myoFirstRestSeconds: schema.quickActivities.myoFirstRestSeconds,
      myoSets: schema.quickActivities.myoSets,
      performedAt: schema.quickActivities.performedAt,
    })
    .from(schema.quickActivities)
    .innerJoin(
      schema.exercises,
      eq(schema.exercises.id, schema.quickActivities.exerciseId),
    )
    .where(
      and(
        eq(schema.quickActivities.userId, userId),
        eq(dayExpr, dayIso),
      ),
    )
    .orderBy(desc(schema.quickActivities.performedAt));
  return rows;
}

export type RecentQuickExercise = {
  exerciseId: string;
  exerciseName: string;
  /** Последний использованный режим — префилл шита (эспандер помнит «тотал»,
   *  подтягивания — «подходами»). */
  mode: "sets" | "total" | "myo_reps";
  /** Последние повторы — префилл степпера. */
  reps: number;
  weightKg: number | null;
  myoActivationReps: number | null;
  myoMiniSets: number | null;
  myoMiniReps: number | null;
  myoRestSeconds: number | null;
  myoFirstRestSeconds: number | null;
  myoSets: QuickMyoSet[] | null;
};

/** Последние РАЗНЫЕ упражнения доп. активности (по свежести) с их последней
 *  записью — чипы быстрого повтора: тап по чипу префиллит упражнение, режим и
 *  повторы. Дедуп в JS по свежим 60 строкам (упражнений в обиходе единицы). */
export async function listRecentQuickExercises(
  userId: string,
  limit = 4,
): Promise<RecentQuickExercise[]> {
  const rows = await db
    .select({
      exerciseId: schema.quickActivities.exerciseId,
      exerciseName: schema.exercises.nameRu,
      mode: schema.quickActivities.mode,
      reps: schema.quickActivities.reps,
      weightKg: schema.quickActivities.weightKg,
      myoActivationReps: schema.quickActivities.myoActivationReps,
      myoMiniSets: schema.quickActivities.myoMiniSets,
      myoMiniReps: schema.quickActivities.myoMiniReps,
      myoRestSeconds: schema.quickActivities.myoRestSeconds,
      myoFirstRestSeconds: schema.quickActivities.myoFirstRestSeconds,
      myoSets: schema.quickActivities.myoSets,
    })
    .from(schema.quickActivities)
    .innerJoin(
      schema.exercises,
      eq(schema.exercises.id, schema.quickActivities.exerciseId),
    )
    .where(eq(schema.quickActivities.userId, userId))
    .orderBy(desc(schema.quickActivities.performedAt))
    .limit(60);

  const seen = new Set<string>();
  const recent: RecentQuickExercise[] = [];
  for (const r of rows) {
    if (seen.has(r.exerciseId)) continue;
    seen.add(r.exerciseId);
    recent.push(r);
    if (recent.length >= limit) break;
  }
  return recent;
}
