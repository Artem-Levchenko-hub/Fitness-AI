import { pgEnum } from "drizzle-orm/pg-core";

export const weightUnit = pgEnum("weight_unit", ["kg", "lb"]);

export const experienceLevel = pgEnum("experience_level", [
  "beginner",
  "intermediate",
  "advanced",
]);

export const localeEnum = pgEnum("locale", ["ru", "en"]);

export const muscleGroupKey = pgEnum("muscle_group_key", [
  "chest",
  "back_lats",
  "back_traps",
  "shoulders_front",
  "shoulders_side",
  "shoulders_rear",
  "biceps",
  "triceps",
  "forearms",
  "core",
  "glutes",
  "quads",
  "hamstrings",
  "calves",
]);

export const muscleRole = pgEnum("muscle_role", ["primary", "secondary"]);

export const workoutStatus = pgEnum("workout_status", [
  "active",
  "completed",
  "cancelled",
]);

export const setType = pgEnum("set_type", [
  "working",
  "warmup",
  "drop",
  "failure",
]);

export const noteEntityType = pgEnum("note_entity_type", [
  "exercise",
  "workout",
  "cycle",
]);

export const noteSource = pgEnum("note_source", ["manual", "auto_generated"]);

export const aiJobStatus = pgEnum("ai_job_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
]);

export const subscriptionTier = pgEnum("subscription_tier", ["free", "pro"]);

export const subscriptionStatus = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "paused",
]);
