import { relations, sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { setType, workoutStatus } from "./enums";
import { exercises } from "./exercises";
import { workoutTemplates } from "./templates";

/** Тренировка — выполненная (или активная) сессия. Может быть создана
 *  по шаблону (templateId) или ad-hoc (templateId IS NULL). */
export const workouts = pgTable(
  "workouts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    templateId: text("template_id").references(() => workoutTemplates.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    status: workoutStatus("status").notNull().default("active"),
    startedAt: timestamp("started_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { mode: "date", withTimezone: true }),
    totalDurationSeconds: integer("total_duration_seconds"),
    notes: text("notes"),
    /** Стабильный client-generated UUID офлайн-СТАРТА (H15.3c-2 outbox). NULL для
     *  всех онлайн/legacy-тренировок. Канонический ключ идемпотентности реплея
     *  старта: дренаж outbox при реконнекте создаёт тренировку под этим ключом,
     *  повторный дренаж находит уже созданную (existing-check в repo) →
     *  partial-unique ниже отвергает дубль ТОЛЬКО среди non-null значений
     *  (legacy/онлайн-строки не трогаются, столп 4). */
    clientWorkoutId: text("client_workout_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("workouts_user_idx").on(t.userId, t.startedAt),
    index("workouts_status_idx").on(t.status),
    uniqueIndex("workouts_client_workout_id_uq")
      .on(t.clientWorkoutId)
      .where(sql`${t.clientWorkoutId} is not null`),
  ],
);

/** Упражнение в тренировке (с порядком). */
export const workoutExercises = pgTable(
  "workout_exercises",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workoutId: text("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    notes: text("notes"),
    /**
     * Снимок назначения тренера на момент старта. Шаблон может безопасно
     * обновиться после другой тренировки: уже начатая сессия от этого не
     * меняет ни вес, ни повторы, ни Myo-протокол. NULL — legacy-сессия,
     * для которой repo временно читает цели из шаблона.
     */
    targetSets: integer("target_sets"),
    targetRepsMin: integer("target_reps_min"),
    targetRepsMax: integer("target_reps_max"),
    targetWeightKg: doublePrecision("target_weight_kg"),
    targetRestSeconds: integer("target_rest_seconds"),
    myoReps: boolean("myo_reps"),
    myoMiniSets: integer("myo_mini_sets"),
    myoMiniReps: integer("myo_mini_reps"),
    myoMiniRestSeconds: integer("myo_mini_rest_seconds"),
  },
  (t) => [
    index("workout_exercises_workout_idx").on(t.workoutId, t.position),
    index("workout_exercises_exercise_idx").on(t.exerciseId),
  ],
);

/** Подход — атомарная единица нагрузки.
 *  weightKg хранится в килограммах независимо от пользовательских units;
 *  отображение конвертируется в lb для тех, кто выбрал lb (R-7 — domain
 *  всегда в kg). RPE — Rate of Perceived Exertion 6-10 (опц).
 *  restSeconds — фактический отдых перед этим подходом. */
export const workoutSets = pgTable(
  "workout_sets",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workoutExerciseId: text("workout_exercise_id")
      .notNull()
      .references(() => workoutExercises.id, { onDelete: "cascade" }),
    setIndex: integer("set_index").notNull(),
    setType: setType("set_type").notNull().default("working"),
    weightKg: doublePrecision("weight_kg").notNull(),
    reps: integer("reps").notNull(),
    rpe: doublePrecision("rpe"),
    restSeconds: integer("rest_seconds"),
    /** Стабильный client-generated UUID офлайн-подхода (H15.3 outbox). NULL для
     *  всех онлайн/legacy-строк. Канонический ключ идемпотентности реплея:
     *  partial-unique ниже отвергает дубль ТОЛЬКО среди non-null значений —
     *  legacy-строки не трогаются (столп 4). */
    clientSetId: text("client_set_id"),
    completedAt: timestamp("completed_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (t) => [
    index("workout_sets_we_idx").on(t.workoutExerciseId, t.setIndex),
    index("workout_sets_completed_idx").on(t.completedAt),
    uniqueIndex("workout_sets_client_set_id_uq")
      .on(t.clientSetId)
      .where(sql`${t.clientSetId} is not null`),
  ],
);

export const workoutsRelations = relations(workouts, ({ one, many }) => ({
  user: one(users, { fields: [workouts.userId], references: [users.id] }),
  template: one(workoutTemplates, {
    fields: [workouts.templateId],
    references: [workoutTemplates.id],
  }),
  exercises: many(workoutExercises),
}));

export const workoutExercisesRelations = relations(
  workoutExercises,
  ({ one, many }) => ({
    workout: one(workouts, {
      fields: [workoutExercises.workoutId],
      references: [workouts.id],
    }),
    exercise: one(exercises, {
      fields: [workoutExercises.exerciseId],
      references: [exercises.id],
    }),
    sets: many(workoutSets),
  }),
);

export const workoutSetsRelations = relations(workoutSets, ({ one }) => ({
  workoutExercise: one(workoutExercises, {
    fields: [workoutSets.workoutExerciseId],
    references: [workoutExercises.id],
  }),
}));

export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;
export type WorkoutExercise = typeof workoutExercises.$inferSelect;
export type WorkoutSet = typeof workoutSets.$inferSelect;
export type NewWorkoutSet = typeof workoutSets.$inferInsert;
