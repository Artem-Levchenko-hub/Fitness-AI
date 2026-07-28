import { relations } from "drizzle-orm";
import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { quickActivityMode } from "./enums";
import { exercises } from "./exercises";

export type QuickMyoSet = {
  role: "activation" | "mini";
  reps: number;
  weightKg: number | null;
  restSeconds: number | null;
};

/** Доп. активность — быстрый лог «сделал подход между делом» БЕЗ создания
 *  тренировки (подошёл к турнику → записал подход; пожал эспандер 100 раз →
 *  записал тотал). Отдельная таблица по прецеденту кардио/круговых: каждый
 *  формат живёт в своей таблице и МЕРЖИТСЯ в статистику/нагрев аватара/
 *  недельный AI-разбор третьим источником (см. stats.repo).
 *
 *  Одна строка = один подход (mode='sets') ИЛИ одна суммарная запись
 *  (mode='total', reps = суммарные повторы). weightKg — добавка (подтягивания
 *  с весом); NULL = без веса/bodyweight → тоннаж 0, но подход и повторы
 *  считаются (как в круговых). */
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
    weightKg: doublePrecision("weight_kg"),
    /** Myo-reps: активационный подход; для обычных режимов NULL. */
    myoActivationReps: integer("myo_activation_reps"),
    /** Myo-reps: число мини-подходов; для обычных режимов NULL. */
    myoMiniSets: integer("myo_mini_sets"),
    /** Myo-reps: повторы в одном мини-подходе; для обычных режимов NULL. */
    myoMiniReps: integer("myo_mini_reps"),
    /** Короткий отдых внутри Myo-кластера; это НЕ длинный межсетовый отдых. */
    myoRestSeconds: integer("myo_rest_seconds"),
    myoFirstRestSeconds: integer("myo_first_rest_seconds"),
    myoSets: jsonb("myo_sets").$type<QuickMyoSet[]>(),
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
