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

/** Расписание тренировок — повторяющееся напоминание «пора тренироваться».
 *  Модель совпадает с почасовым cron'ом push-reminders (проверяет локальный
 *  час юзера): храним день недели + час, без минут и без persisted next_run —
 *  cron сам считает «сегодня входит в daysOfWeek И localHour === hour».
 *
 *  - label = что тренировать («Ноги», «Грудь+трицепс»). Напоминание ведёт на
 *    /create (выбор формата); прямой запуск конкретного шаблона — отдельно
 *    (YAGNI до запроса владельца).
 *  - daysOfWeek = ISO-дни недели (1=Пн .. 7=Вс), отсортированные уникальные.
 *  - hour = локальный час 0..23.
 *  - enabled = выключенное расписание не шлёт пуш (run-3b). */
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
