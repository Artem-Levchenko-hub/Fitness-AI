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
import { exercises } from "./exercises";

/** Шаблон тренировки. Принадлежит пользователю — стабильный набор
 *  упражнений с целевыми параметрами. */
export const workoutTemplates = pgTable(
  "workout_templates",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("workout_templates_user_idx").on(t.userId)],
);

/** Упражнение в шаблоне с порядком и целевыми параметрами.
 *  targetWeight/Reps/Rest — рекомендация, фактические значения
 *  пишутся в workout_sets при выполнении. */
export const templateExercises = pgTable(
  "template_exercises",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    templateId: text("template_id")
      .notNull()
      .references(() => workoutTemplates.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    targetSets: integer("target_sets").notNull().default(3),
    targetRepsMin: integer("target_reps_min").notNull().default(8),
    targetRepsMax: integer("target_reps_max").notNull().default(12),
    targetWeightKg: doublePrecision("target_weight_kg"),
    targetRestSeconds: integer("target_rest_seconds").notNull().default(120),
    notes: text("notes"),
  },
  (t) => [
    index("template_exercises_template_idx").on(t.templateId, t.position),
  ],
);

export const workoutTemplatesRelations = relations(
  workoutTemplates,
  ({ one, many }) => ({
    user: one(users, {
      fields: [workoutTemplates.userId],
      references: [users.id],
    }),
    items: many(templateExercises),
  }),
);

export const templateExercisesRelations = relations(
  templateExercises,
  ({ one }) => ({
    template: one(workoutTemplates, {
      fields: [templateExercises.templateId],
      references: [workoutTemplates.id],
    }),
    exercise: one(exercises, {
      fields: [templateExercises.exerciseId],
      references: [exercises.id],
    }),
  }),
);

export type WorkoutTemplate = typeof workoutTemplates.$inferSelect;
export type NewWorkoutTemplate = typeof workoutTemplates.$inferInsert;
export type TemplateExercise = typeof templateExercises.$inferSelect;
