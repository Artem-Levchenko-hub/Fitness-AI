import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";

/** Привязка расписания к конкретной заготовке одного из трёх форматов (G7a).
 *  R-29: три отдельных FK, не полиморфный type+id — здесь kind лишь выбирает,
 *  в какой столбец лечь. */
export type SchedulePresetLink = {
  kind: "template" | "circuit" | "cardio";
  id: string;
};

export type NewScheduleInput = {
  label: string;
  daysOfWeek: number[];
  hour: number;
  /** Опц. привязка к заготовке. null/undefined = «свободное» расписание. */
  preset?: SchedulePresetLink | null;
};

/** R-7: убеждаемся, что заготовка принадлежит юзеру. FK гарантирует только
 *  существование строки, но не владельца — без RLS защищаем сами. Бросает,
 *  если заготовка не найдена среди заготовок этого юзера. */
async function assertPresetOwned(
  userId: string,
  preset: SchedulePresetLink,
): Promise<void> {
  const table =
    preset.kind === "template"
      ? schema.workoutTemplates
      : preset.kind === "circuit"
        ? schema.circuitWorkouts
        : schema.cardioWorkouts;

  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, preset.id), eq(table.userId, userId)))
    .limit(1);

  if (!row) throw new Error("Заготовка не найдена");
}

/** Раскладывает привязку в три nullable-столбца (ровно один заполнен). */
function presetColumns(preset: SchedulePresetLink | null | undefined): {
  templateId: string | null;
  circuitWorkoutId: string | null;
  cardioWorkoutId: string | null;
} {
  return {
    templateId: preset?.kind === "template" ? preset.id : null,
    circuitWorkoutId: preset?.kind === "circuit" ? preset.id : null,
    cardioWorkoutId: preset?.kind === "cardio" ? preset.id : null,
  };
}

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

/** Включённые расписания юзера (R-7). Для почасового cron'а push-reminders:
 *  он сам проверяет день недели + час против локального времени юзера. */
export async function listEnabledSchedulesForUser(
  userId: string,
): Promise<schema.WorkoutSchedule[]> {
  return db
    .select()
    .from(schema.workoutSchedules)
    .where(
      and(
        eq(schema.workoutSchedules.userId, userId),
        eq(schema.workoutSchedules.enabled, true),
      ),
    );
}

export async function createSchedule(
  userId: string,
  input: NewScheduleInput,
): Promise<{ id: string }> {
  if (input.preset) await assertPresetOwned(userId, input.preset);

  const [row] = await db
    .insert(schema.workoutSchedules)
    .values({
      userId,
      label: input.label,
      daysOfWeek: input.daysOfWeek,
      hour: input.hour,
      ...presetColumns(input.preset),
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
