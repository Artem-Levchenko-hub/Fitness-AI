import { relations } from "drizzle-orm";
import {
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { quickActivityMode } from "./enums";
import { exercises } from "./exercises";

/** Доп. активность — быстрый лог «сделал подход между делом» БЕЗ создания
 *  тренировки (подошёл к турнику → записал подход; пожал эспандер 100 раз →
 *  записал тотал). Отдельная таблица по прецеденту кардио/круговых: каждый
 *  формат живёт в своей таблице и МЕРЖИТСЯ в статистику/нагрев аватара/
 *  недельный AI-разбор третьим источником (см. stats.repo).
 *
 *  Одна строка = один подход (mode='sets'), один Myo-кластер (mode='myo_reps')
 *  или одна суммарная запись (mode='total', reps = суммарные повторы).
 *  Для Myo `reps` — активация, а myoMiniSets/myoMiniReps — короткие мини-сеты.
 *  weightKg — добавка (подтягивания с весом); NULL = без веса/bodyweight →
 *  тоннаж 0, но подходы и повторы считаются (как в круговых). */
export const quickActivities = pgTable(
  "quick_activities",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "restrict" }),
    mode: quickActivityMode("mode").notNull().default("sets"),
    reps: integer("reps").notNull(),
    myoMiniSets: integer("myo_mini_sets"),
    myoMiniReps: integer("myo_mini_reps"),
    weightKg: doublePrecision("weight_kg"),
    performedAt: timestamp("performed_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("quick_activities_user_performed_idx").on(t.userId, t.performedAt),
    index("quick_activities_exercise_idx").on(t.exerciseId),
  ],
);

export const quickActivitiesRelations = relations(
  quickActivities,
  ({ one }) => ({
    user: one(users, {
      fields: [quickActivities.userId],
      references: [users.id],
    }),
    exercise: one(exercises, {
      fields: [quickActivities.exerciseId],
      references: [exercises.id],
    }),
  }),
);

export type QuickActivity = typeof quickActivities.$inferSelect;
export type NewQuickActivity = typeof quickActivities.$inferInsert;
