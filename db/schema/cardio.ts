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
import { cardioBlockKind, cardioPreset, workoutStatus } from "./enums";

/** Кардио-сессия (HIIT / интервалы / стационарное кардио).
 *  Отдельная от силовых workouts — другие метрики (длительность вместо
 *  веса×повторений, HR/RPE по блокам).
 *
 *  - preset = типовая схема (tabata, 4x4, EMOM) или 'custom' с
 *    parametric планом (rounds×workSec/restSec) в planJson.
 *  - planJson = снимок параметров для отображения и AI-контекста.
 *    Read-only после создания. */
export const cardioWorkouts = pgTable(
  "cardio_workouts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    preset: cardioPreset("preset").notNull().default("custom"),
    planJson: jsonb("plan_json"),
    status: workoutStatus("status").notNull().default("active"),
    startedAt: timestamp("started_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", {
      mode: "date",
      withTimezone: true,
    }),
    /** Заметка «как прошло» после завершения (G7c feeling-note, как у силовой
     *  workouts.notes / circuit_workouts.notes). Nullable: большинство сессий
     *  без заметки. AI читает целиком при разборе. */
    notes: text("notes"),
  },
  (t) => [
    index("cardio_workouts_user_started_idx").on(t.userId, t.startedAt),
    index("cardio_workouts_user_status_idx").on(t.userId, t.status),
  ],
);

/** Один блок (раунд) кардио — работа или отдых.
 *  Все блоки пре-генерируются при старте на основе preset+planJson.
 *  По мере выполнения юзер обновляет actualDurationSec/hrAvg/rpe.
 *  HR/RPE имеют смысл только для work; UI не показывает их для rest. */
export const cardioBlocks = pgTable(
  "cardio_blocks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    cardioWorkoutId: text("cardio_workout_id")
      .notNull()
      .references(() => cardioWorkouts.id, { onDelete: "cascade" }),
    blockIndex: integer("block_index").notNull(),
    kind: cardioBlockKind("kind").notNull(),
    label: text("label").notNull(),
    plannedDurationSec: integer("planned_duration_sec").notNull(),
    actualDurationSec: integer("actual_duration_sec"),
    hrAvg: integer("hr_avg"),
    rpe: doublePrecision("rpe"),
    notes: text("notes"),
    completedAt: timestamp("completed_at", {
      mode: "date",
      withTimezone: true,
    }),
  },
  (t) => [
    index("cardio_blocks_workout_idx").on(t.cardioWorkoutId, t.blockIndex),
  ],
);

export const cardioWorkoutsRelations = relations(
  cardioWorkouts,
  ({ one, many }) => ({
    user: one(users, {
      fields: [cardioWorkouts.userId],
      references: [users.id],
    }),
    blocks: many(cardioBlocks),
  }),
);

export const cardioBlocksRelations = relations(cardioBlocks, ({ one }) => ({
  cardioWorkout: one(cardioWorkouts, {
    fields: [cardioBlocks.cardioWorkoutId],
    references: [cardioWorkouts.id],
  }),
}));

export type CardioWorkout = typeof cardioWorkouts.$inferSelect;
export type NewCardioWorkout = typeof cardioWorkouts.$inferInsert;
export type CardioBlock = typeof cardioBlocks.$inferSelect;
export type NewCardioBlock = typeof cardioBlocks.$inferInsert;
