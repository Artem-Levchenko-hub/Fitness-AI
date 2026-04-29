import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { muscleGroupKey, muscleRole } from "./enums";

/** Reference table — позволяет хранить локализуемые названия групп мышц
 *  (название из enum — стабильный ключ, имя в ru/en — отдельная таблица). */
export const muscleGroups = pgTable("muscle_groups", {
  key: muscleGroupKey("key").primaryKey(),
  nameRu: text("name_ru").notNull(),
  nameEn: text("name_en").notNull(),
});

/** Каталог упражнений: system (ownerUserId IS NULL, isCustom = false) +
 *  custom user-owned (isCustom = true). RLS заменён DAL — repos фильтруют
 *  выборки по userId. */
export const exercises = pgTable(
  "exercises",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    slug: text("slug").notNull(),
    nameRu: text("name_ru").notNull(),
    nameEn: text("name_en").notNull(),
    description: text("description"),
    isCustom: boolean("is_custom").notNull().default(false),
    ownerUserId: text("owner_user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("exercises_slug_owner_unq").on(t.slug, t.ownerUserId),
    index("exercises_owner_idx").on(t.ownerUserId),
  ],
);

/** M2M упражнение ↔ группа мышц с ролью (primary / secondary).
 *  Используется для расчёта volume по группам мышц. */
export const exerciseMuscleGroups = pgTable(
  "exercise_muscle_groups",
  {
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    muscleGroupKey: muscleGroupKey("muscle_group_key").notNull(),
    role: muscleRole("role").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.exerciseId, t.muscleGroupKey, t.role] }),
    index("exercise_muscle_groups_muscle_idx").on(t.muscleGroupKey),
  ],
);

export const exercisesRelations = relations(exercises, ({ one, many }) => ({
  owner: one(users, {
    fields: [exercises.ownerUserId],
    references: [users.id],
  }),
  muscleGroups: many(exerciseMuscleGroups),
}));

export const exerciseMuscleGroupsRelations = relations(
  exerciseMuscleGroups,
  ({ one }) => ({
    exercise: one(exercises, {
      fields: [exerciseMuscleGroups.exerciseId],
      references: [exercises.id],
    }),
  }),
);

export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;
