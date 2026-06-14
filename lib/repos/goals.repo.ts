import { and, desc, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import type { Goal } from "@/db/schema";

/** Цель крепится РОВНО к одному носителю — упражнению ИЛИ группе мышц.
 *  Дискриминированный вход делает «оба сразу» / «ни одного» непредставимыми
 *  на уровне типов (инвариант схемы — в коде, не DB-CHECK). */
export type GoalTarget =
  | { exerciseId: string; muscleGroupKey?: never }
  | { muscleGroupKey: schema.Goal["muscleGroupKey"]; exerciseId?: never };

export type CreateGoalInput = GoalTarget & {
  kind: schema.Goal["kind"];
  targetValue: number;
  targetDate?: Date | null;
};

/** H18.1 — создаёт цель пользователя (R-7: userId явный, цель принадлежит
 *  вызывающему; нет RLS — фильтруем сами). Возвращает id. */
export async function createGoal(
  userId: string,
  input: CreateGoalInput,
): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  await db.insert(schema.goals).values({
    id,
    userId,
    exerciseId: input.exerciseId ?? null,
    muscleGroupKey:
      "muscleGroupKey" in input ? (input.muscleGroupKey ?? null) : null,
    kind: input.kind,
    targetValue: input.targetValue,
    targetDate: input.targetDate ?? null,
  });
  return { id };
}

/** H18.1 — все цели пользователя, свежие сверху (R-7: фильтр по userId). */
export async function listGoals(userId: string): Promise<Goal[]> {
  return db
    .select()
    .from(schema.goals)
    .where(eq(schema.goals.userId, userId))
    .orderBy(desc(schema.goals.createdAt));
}

/** H18.2 — активная цель упражнения (свежайшая; null если не задана).
 *  R-7: фильтр по userId — чужую цель не достанем. */
export async function getExerciseGoal(
  userId: string,
  exerciseId: string,
): Promise<Goal | null> {
  const [row] = await db
    .select()
    .from(schema.goals)
    .where(
      and(
        eq(schema.goals.userId, userId),
        eq(schema.goals.exerciseId, exerciseId),
      ),
    )
    .orderBy(desc(schema.goals.createdAt))
    .limit(1);
  return row ?? null;
}

/** H18.2 — снимает ВСЕ цели упражнения пользователя (постановка новой цели
 *  заменяет прежнюю — один активный таргет на упражнение, без дублей строк).
 *  R-7: только свои; чужие не трогаются. */
export async function clearExerciseGoals(
  userId: string,
  exerciseId: string,
): Promise<void> {
  await db
    .delete(schema.goals)
    .where(
      and(
        eq(schema.goals.userId, userId),
        eq(schema.goals.exerciseId, exerciseId),
      ),
    );
}

/** H18.2 — все цели пользователя, прикреплённые к группам мышц (дрилл мышцы),
 *  свежайшая на группу. Один запрос (карта вместо 14 точечных) → передаётся
 *  в buildAvatarData. R-7: только свои цели. */
export async function getMuscleGroupGoals(
  userId: string,
): Promise<Map<string, Goal>> {
  const rows = await db
    .select()
    .from(schema.goals)
    .where(
      and(
        eq(schema.goals.userId, userId),
        isNotNull(schema.goals.muscleGroupKey),
      ),
    )
    .orderBy(desc(schema.goals.createdAt));
  // rows свежие сверху → первая встреченная по ключу = активная цель группы.
  const out = new Map<string, Goal>();
  for (const row of rows) {
    if (row.muscleGroupKey && !out.has(row.muscleGroupKey)) {
      out.set(row.muscleGroupKey, row);
    }
  }
  return out;
}

/** H18.2 — снимает ВСЕ цели группы мышц пользователя (постановка новой цели
 *  заменяет прежнюю — один активный таргет на группу, без дублей строк).
 *  R-7: только свои; чужие не трогаются. */
export async function clearMuscleGroupGoals(
  userId: string,
  muscleGroupKey: NonNullable<schema.Goal["muscleGroupKey"]>,
): Promise<void> {
  await db
    .delete(schema.goals)
    .where(
      and(
        eq(schema.goals.userId, userId),
        eq(schema.goals.muscleGroupKey, muscleGroupKey),
      ),
    );
}

/** H18.1 — удаляет цель (R-7: только свою; чужая/несуществующая → no-op). */
export async function deleteGoal(
  userId: string,
  goalId: string,
): Promise<void> {
  await db
    .delete(schema.goals)
    .where(and(eq(schema.goals.id, goalId), eq(schema.goals.userId, userId)));
}
