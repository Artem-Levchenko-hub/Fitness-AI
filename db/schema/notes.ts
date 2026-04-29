import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { noteSource } from "./enums";
import { exercises } from "./exercises";
import { workouts } from "./workouts";

/** Заметка к упражнению — накапливает историю прогресса по конкретному
 *  упражнению пользователя. AI читает её целиком при анализе. */
export const exerciseNotes = pgTable(
  "exercise_notes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    content: text("content").notNull().default(""),
    source: noteSource("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("exercise_notes_user_idx").on(t.userId, t.exerciseId),
    index("exercise_notes_updated_idx").on(t.updatedAt),
  ],
);

/** Заметка к тренировке — снапшот после finishWorkout: PRs, объём,
 *  что чувствовал атлет. Auto-generated + ручные правки.
 *  Используется AI как контекст при анализе следующей тренировки. */
export const workoutNotes = pgTable(
  "workout_notes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workoutId: text("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    content: text("content").notNull().default(""),
    source: noteSource("source").notNull().default("auto_generated"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("workout_notes_user_idx").on(t.userId, t.workoutId)],
);

/** Заметка по микроциклу (ISO-неделя) — агрегированный отчёт за неделю:
 *  объём по группам мышц, суммарная частота, замеченные тренды.
 *  weekIso формата "YYYY-Www" (например 2026-W18). */
export const cycleNotes = pgTable(
  "cycle_notes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekIso: text("week_iso").notNull(),
    content: text("content").notNull().default(""),
    source: noteSource("source").notNull().default("auto_generated"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("cycle_notes_user_week_idx").on(t.userId, t.weekIso)],
);

export const exerciseNotesRelations = relations(exerciseNotes, ({ one }) => ({
  user: one(users, {
    fields: [exerciseNotes.userId],
    references: [users.id],
  }),
  exercise: one(exercises, {
    fields: [exerciseNotes.exerciseId],
    references: [exercises.id],
  }),
}));

export const workoutNotesRelations = relations(workoutNotes, ({ one }) => ({
  user: one(users, { fields: [workoutNotes.userId], references: [users.id] }),
  workout: one(workouts, {
    fields: [workoutNotes.workoutId],
    references: [workouts.id],
  }),
}));

export const cycleNotesRelations = relations(cycleNotes, ({ one }) => ({
  user: one(users, { fields: [cycleNotes.userId], references: [users.id] }),
}));

export type ExerciseNote = typeof exerciseNotes.$inferSelect;
export type NewExerciseNote = typeof exerciseNotes.$inferInsert;
export type WorkoutNote = typeof workoutNotes.$inferSelect;
export type CycleNote = typeof cycleNotes.$inferSelect;
