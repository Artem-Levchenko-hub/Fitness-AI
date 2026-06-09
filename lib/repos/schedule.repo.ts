import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";

export type NewScheduleInput = {
  label: string;
  daysOfWeek: number[];
  hour: number;
};

/** Все расписания юзера (R-7: фильтр по userId). Сортировка по часу. */
export async function listSchedules(
  userId: string,
): Promise<schema.WorkoutSchedule[]> {
  return db
    .select()
    .from(schema.workoutSchedules)
    .where(eq(schema.workoutSchedules.userId, userId))
    .orderBy(asc(schema.workoutSchedules.hour));
}

export async function createSchedule(
  userId: string,
  input: NewScheduleInput,
): Promise<{ id: string }> {
  const [row] = await db
    .insert(schema.workoutSchedules)
    .values({
      userId,
      label: input.label,
      daysOfWeek: input.daysOfWeek,
      hour: input.hour,
    })
    .returning({ id: schema.workoutSchedules.id });
  return { id: row!.id };
}

export async function deleteSchedule(
  userId: string,
  id: string,
): Promise<void> {
  await db
    .delete(schema.workoutSchedules)
    .where(
      and(
        eq(schema.workoutSchedules.id, id),
        eq(schema.workoutSchedules.userId, userId),
      ),
    );
}

export async function setScheduleEnabled(
  userId: string,
  id: string,
  enabled: boolean,
): Promise<void> {
  await db
    .update(schema.workoutSchedules)
    .set({ enabled, updatedAt: new Date() })
    .where(
      and(
        eq(schema.workoutSchedules.id, id),
        eq(schema.workoutSchedules.userId, userId),
      ),
    );
}
