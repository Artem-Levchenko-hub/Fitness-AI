import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { cardioWorkouts } from "./cardio";
import { circuitWorkouts } from "./circuit";
import { workoutTemplates } from "./templates";

/** Расписание тренировок — повторяющееся напоминание «пора тренироваться».
 *  Модель совпадает с почасовым cron'ом push-reminders (проверяет локальный
 *  час юзера): храним день недели + час, без минут и без persisted next_run —
 *  cron сам считает «сегодня входит в daysOfWeek И localHour === hour».
 *
 *  - label = что тренировать («Ноги», «Грудь+трицепс»).
 *  - daysOfWeek = ISO-дни недели (1=Пн .. 7=Вс), отсортированные уникальные.
 *  - hour = локальный час 0..23.
 *  - enabled = выключенное расписание не шлёт пуш (run-3b).
 *  - templateId / circuitWorkoutId / cardioWorkoutId (G7a) — опциональная
 *    привязка к КОНКРЕТНОЙ заготовке тренировки одного из трёх форматов.
 *    Все три nullable: NULL во всех трёх = «свободное» расписание (ведёт на
 *    /create-пикер, как раньше). Ровно одна заполнена = «сегодня надо вот
 *    эту» → прямой запуск (G7b). R-29: три отдельных FK вместо полиморфного
 *    type+id. ON DELETE SET NULL: удалили заготовку → расписание остаётся,
 *    просто снова становится «свободным» (напоминание само по себе валидно).
 *    Foundation-слайс: пока НИЧТО не читает эти столбцы (нулевое изменение
 *    поведения); repo-запись и подсветка «сегодня» — следующими ранами. */
export const workoutSchedules = pgTable(
  "workout_schedules",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    daysOfWeek: integer("days_of_week").array().notNull(),
    hour: integer("hour").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    templateId: text("template_id").references(() => workoutTemplates.id, {
      onDelete: "set null",
    }),
    circuitWorkoutId: text("circuit_workout_id").references(
      () => circuitWorkouts.id,
      { onDelete: "set null" },
    ),
    cardioWorkoutId: text("cardio_workout_id").references(
      () => cardioWorkouts.id,
      { onDelete: "set null" },
    ),

    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("workout_schedules_user_idx").on(t.userId)],
);

export const workoutSchedulesRelations = relations(
  workoutSchedules,
  ({ one }) => ({
    user: one(users, {
      fields: [workoutSchedules.userId],
      references: [users.id],
    }),
  }),
);

export type WorkoutSchedule = typeof workoutSchedules.$inferSelect;
export type NewWorkoutSchedule = typeof workoutSchedules.$inferInsert;
