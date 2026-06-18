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
import { circuitExerciseKind } from "./enums";
import { exercises } from "./exercises";

/** Шаблон круговой тренировки (H14). Принадлежит пользователю — именованный
 *  переиспользуемый пресет круговой: параметры круга (раунды, паузы) + список
 *  упражнений с целями. Зеркалит circuit_workouts, но без runtime-полей
 *  (status/startedAt/finishedAt/логи) и с template-таймстампами (как
 *  workout_templates). Старт из шаблона переиспользует startCircuit (H14.2). */
export const circuitTemplates = pgTable(
  "circuit_templates",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    totalRounds: integer("total_rounds").notNull().default(3),
    restBetweenRoundsSec: integer("rest_between_rounds_sec")
      .notNull()
      .default(60),
    restBetweenExercisesSec: integer("rest_between_exercises_sec")
      .notNull()
      .default(15),
    /** Последняя круговая, по которой тренер адаптировал шаблон на месте под
     *  факт (повторы/время/отдыхи/круги, изредка свап). Ключ идемпотентности
     *  (повторный прогон job = no-op) И маркер «обновлён тренером» для бейджа
     *  в /templates (non-null = адаптирован). Плоский text (зеркало
     *  lastAdaptedWorkoutId у силовых) — без FK, чтобы не плодить цикл схем. */
    lastAdaptedCircuitWorkoutId: text("last_adapted_circuit_workout_id"),
    archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("circuit_templates_user_idx").on(t.userId)],
);

/** Упражнение в круговом шаблоне — пре-заданные параметры (kind/target/вес),
 *  зеркало circuit_exercises. exerciseId restrict — нельзя удалить упражнение,
 *  на которое ссылается шаблон. */
export const circuitTemplateExercises = pgTable(
  "circuit_template_exercises",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    circuitTemplateId: text("circuit_template_id")
      .notNull()
      .references(() => circuitTemplates.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "restrict" }),
    orderIdx: integer("order_idx").notNull(),
    kind: circuitExerciseKind("kind").notNull(),
    targetReps: integer("target_reps"),
    targetDurationSec: integer("target_duration_sec"),
    targetWeightKg: doublePrecision("target_weight_kg"),
    notes: text("notes"),
  },
  (t) => [
    index("circuit_template_exercises_template_idx").on(
      t.circuitTemplateId,
      t.orderIdx,
    ),
    index("circuit_template_exercises_exercise_idx").on(t.exerciseId),
  ],
);

export const circuitTemplatesRelations = relations(
  circuitTemplates,
  ({ one, many }) => ({
    user: one(users, {
      fields: [circuitTemplates.userId],
      references: [users.id],
    }),
    exercises: many(circuitTemplateExercises),
  }),
);

export const circuitTemplateExercisesRelations = relations(
  circuitTemplateExercises,
  ({ one }) => ({
    circuitTemplate: one(circuitTemplates, {
      fields: [circuitTemplateExercises.circuitTemplateId],
      references: [circuitTemplates.id],
    }),
    exercise: one(exercises, {
      fields: [circuitTemplateExercises.exerciseId],
      references: [exercises.id],
    }),
  }),
);

export type CircuitTemplate = typeof circuitTemplates.$inferSelect;
export type NewCircuitTemplate = typeof circuitTemplates.$inferInsert;
export type CircuitTemplateExercise =
  typeof circuitTemplateExercises.$inferSelect;
export type NewCircuitTemplateExercise =
  typeof circuitTemplateExercises.$inferInsert;
