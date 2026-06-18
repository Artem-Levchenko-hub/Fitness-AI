import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { circuitExerciseKind, workoutStatus } from "./enums";
import { exercises } from "./exercises";

/** Круговая тренировка (circuit training).
 *  Гибридный формат: каждое упражнение в круге задаётся либо повторениями
 *  (kind=reps + targetReps), либо временем (kind=duration + targetDurationSec).
 *  Вес опционален (для упражнений с весом).
 *
 *  Поток: пользователь создаёт circuit с упражнениями (circuit_exercises) и
 *  параметрами (totalRounds, rest*). В active mode пользователь идёт по
 *  кругам — каждый раунд × каждое упражнение пишется как circuit_round_logs
 *  (один лог на пару round × exercise). */
export const circuitWorkouts = pgTable(
  "circuit_workouts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Круговой шаблон, из которого стартовала сессия (snapshot-копия).
     *  null — ad-hoc круговая (без шаблона). Плоский text (зеркало
     *  sourceWorkoutId у силовых) — нужен, чтобы после finish тренер знал,
     *  какой шаблон адаптировать на месте под факт. */
    sourceTemplateId: text("source_template_id"),
    totalRounds: integer("total_rounds").notNull().default(3),
    restBetweenRoundsSec: integer("rest_between_rounds_sec")
      .notNull()
      .default(60),
    restBetweenExercisesSec: integer("rest_between_exercises_sec")
      .notNull()
      .default(15),
    status: workoutStatus("status").notNull().default("active"),
    startedAt: timestamp("started_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", {
      mode: "date",
      withTimezone: true,
    }),
    notes: text("notes"),
  },
  (t) => [
    index("circuit_workouts_user_started_idx").on(t.userId, t.startedAt),
    index("circuit_workouts_user_status_idx").on(t.userId, t.status),
  ],
);

/** Упражнение в круге — пре-заданные параметры (kind/target/вес).
 *  exerciseId ссылается на каталог exercises (restrict — нельзя удалять
 *  упражнение, на которое ссылается история кругов). */
export const circuitExercises = pgTable(
  "circuit_exercises",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    circuitWorkoutId: text("circuit_workout_id")
      .notNull()
      .references(() => circuitWorkouts.id, { onDelete: "cascade" }),
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
    index("circuit_exercises_workout_idx").on(t.circuitWorkoutId, t.orderIdx),
    index("circuit_exercises_exercise_idx").on(t.exerciseId),
  ],
);

/** Лог одного «слота» — конкретное упражнение в конкретном круге.
 *  Уникальная пара (circuitExerciseId, roundNumber) — апдейтится через
 *  upsert при отметке «Готово» или «Пропустить». */
export const circuitRoundLogs = pgTable(
  "circuit_round_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    circuitWorkoutId: text("circuit_workout_id")
      .notNull()
      .references(() => circuitWorkouts.id, { onDelete: "cascade" }),
    circuitExerciseId: text("circuit_exercise_id")
      .notNull()
      .references(() => circuitExercises.id, { onDelete: "cascade" }),
    roundNumber: integer("round_number").notNull(),
    actualReps: integer("actual_reps"),
    actualDurationSec: integer("actual_duration_sec"),
    actualWeightKg: doublePrecision("actual_weight_kg"),
    rpe: doublePrecision("rpe"),
    completedAt: timestamp("completed_at", {
      mode: "date",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    skipped: boolean("skipped").notNull().default(false),
  },
  (t) => [
    index("circuit_round_logs_workout_round_idx").on(
      t.circuitWorkoutId,
      t.roundNumber,
    ),
    index("circuit_round_logs_exercise_round_idx").on(
      t.circuitExerciseId,
      t.roundNumber,
    ),
  ],
);

export const circuitWorkoutsRelations = relations(
  circuitWorkouts,
  ({ one, many }) => ({
    user: one(users, {
      fields: [circuitWorkouts.userId],
      references: [users.id],
    }),
    exercises: many(circuitExercises),
    logs: many(circuitRoundLogs),
  }),
);

export const circuitExercisesRelations = relations(
  circuitExercises,
  ({ one, many }) => ({
    circuitWorkout: one(circuitWorkouts, {
      fields: [circuitExercises.circuitWorkoutId],
      references: [circuitWorkouts.id],
    }),
    exercise: one(exercises, {
      fields: [circuitExercises.exerciseId],
      references: [exercises.id],
    }),
    logs: many(circuitRoundLogs),
  }),
);

export const circuitRoundLogsRelations = relations(
  circuitRoundLogs,
  ({ one }) => ({
    circuitWorkout: one(circuitWorkouts, {
      fields: [circuitRoundLogs.circuitWorkoutId],
      references: [circuitWorkouts.id],
    }),
    circuitExercise: one(circuitExercises, {
      fields: [circuitRoundLogs.circuitExerciseId],
      references: [circuitExercises.id],
    }),
  }),
);

export type CircuitWorkout = typeof circuitWorkouts.$inferSelect;
export type NewCircuitWorkout = typeof circuitWorkouts.$inferInsert;
export type CircuitExercise = typeof circuitExercises.$inferSelect;
export type NewCircuitExercise = typeof circuitExercises.$inferInsert;
export type CircuitRoundLog = typeof circuitRoundLogs.$inferSelect;
export type NewCircuitRoundLog = typeof circuitRoundLogs.$inferInsert;
