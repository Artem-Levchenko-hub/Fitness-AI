import { relations } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { aiJobStatus } from "./enums";
import { workouts } from "./workouts";

/** Результат AI-анализа тренировки. Markdown с инсайтами от DeepSeek. */
export const aiAnalyses = pgTable(
  "ai_analyses",
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
    content: text("content").notNull(),
    modelVersion: text("model_version").notNull(),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ai_analyses_user_idx").on(t.userId, t.createdAt),
    index("ai_analyses_workout_idx").on(t.workoutId),
  ],
);

/** Outbox для AI-задач (R-31). После finishWorkout создаём pending row;
 *  node-cron worker подхватывает, выставляет running, вызывает DeepSeek,
 *  пишет в ai_analyses, переводит в succeeded. failed после 3 попыток. */
export const aiJobs = pgTable(
  "ai_jobs",
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
    status: aiJobStatus("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    scheduledAt: timestamp("scheduled_at", {
      mode: "date",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { mode: "date", withTimezone: true }),
    finishedAt: timestamp("finished_at", { mode: "date", withTimezone: true }),
  },
  (t) => [
    index("ai_jobs_status_scheduled_idx").on(t.status, t.scheduledAt),
    index("ai_jobs_workout_idx").on(t.workoutId),
  ],
);

export const aiAnalysesRelations = relations(aiAnalyses, ({ one }) => ({
  user: one(users, { fields: [aiAnalyses.userId], references: [users.id] }),
  workout: one(workouts, {
    fields: [aiAnalyses.workoutId],
    references: [workouts.id],
  }),
}));

export const aiJobsRelations = relations(aiJobs, ({ one }) => ({
  user: one(users, { fields: [aiJobs.userId], references: [users.id] }),
  workout: one(workouts, {
    fields: [aiJobs.workoutId],
    references: [workouts.id],
  }),
}));

export type AiAnalysis = typeof aiAnalyses.$inferSelect;
export type NewAiAnalysis = typeof aiAnalyses.$inferInsert;
export type AiJob = typeof aiJobs.$inferSelect;
export type NewAiJob = typeof aiJobs.$inferInsert;
