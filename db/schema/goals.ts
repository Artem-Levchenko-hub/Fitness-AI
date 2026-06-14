import { relations } from "drizzle-orm";
import {
  doublePrecision,
  index,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { goalKind, muscleGroupKey } from "./enums";
import { exercises, muscleGroups } from "./exercises";

/** H18.1 — цель атлета: тренер ведёт ВПЕРЁД (а не только ретроспективно).
 *  Цель крепится ЛИБО к упражнению (exerciseId), ЛИБО к группе мышц
 *  (muscleGroupKey) — носитель столпа 2 (цель на теле). Ровно одно из двух
 *  заполнено; инвариант обеспечивает доменный слой (типы входа repo), не DB-CHECK
 *  (YAGNI до доказанной нужды). targetValue — целевое число (рабочий вес/1ПМ в кг
 *  либо частота раз/нед); doublePrecision как у прочих измеримых величин
 *  (body.weightKg) → число в TS без string-конверсии. Проекция темпа к цели —
 *  чистая projectProgress (lib/domain/progression/goal-projection.ts). UI/AI —
 *  отдельные слайсы (H18.2/H18.3). */
export const goals = pgTable(
  "goals",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id").references(() => exercises.id, {
      onDelete: "cascade",
    }),
    muscleGroupKey: muscleGroupKey("muscle_group_key").references(
      () => muscleGroups.key,
      { onDelete: "cascade" },
    ),
    kind: goalKind("kind").notNull(),
    targetValue: doublePrecision("target_value").notNull(),
    targetDate: timestamp("target_date", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("goals_user_idx").on(t.userId)],
);

export const goalsRelations = relations(goals, ({ one }) => ({
  user: one(users, { fields: [goals.userId], references: [users.id] }),
  exercise: one(exercises, {
    fields: [goals.exerciseId],
    references: [exercises.id],
  }),
}));

export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
