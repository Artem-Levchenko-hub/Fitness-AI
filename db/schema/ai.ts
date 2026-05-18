import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { aiJobKind, aiJobStatus } from "./enums";
import { workouts } from "./workouts";

/** Результат AI-анализа. Markdown в content + опционально structured JSON
 *  в resultJson (для trainer v2). workoutId nullable, т.к. daily_digest
 *  пишет анализ без конкретной тренировки. */
export const aiAnalyses = pgTable(
  "ai_analyses",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workoutId: text("workout_id").references(() => workouts.id, {
      onDelete: "cascade",
    }),
    content: text("content").notNull(),
    /** Structured Gemini JSON (TrainerResponse) — nullable для legacy markdown-only. */
    resultJson: jsonb("result_json"),
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

/** Outbox для AI-задач (R-31). workoutId nullable для daily_digest.
 *  kind различает: post_workout (после тренировки), daily_digest (ночной свод),
 *  on_demand (юзер сам нажал кнопку). */
export const aiJobs = pgTable(
  "ai_jobs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workoutId: text("workout_id").references(() => workouts.id, {
      onDelete: "cascade",
    }),
    kind: aiJobKind("kind").notNull().default("post_workout"),
    status: aiJobStatus("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    /** id записи в ai_analyses после успешной обработки. */
    analysisId: text("analysis_id"),
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
    index("ai_jobs_user_kind_idx").on(t.userId, t.kind, t.scheduledAt),
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
