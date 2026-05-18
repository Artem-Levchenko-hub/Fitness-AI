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

export const aiJobKind = pgEnum("ai_job_kind", [
  "post_workout",
  "daily_digest",
  "on_demand",
]);

export const pushKind = pgEnum("push_kind", [
  "sleep_reminder",
  "nutrition_reminder",
  "trainer_ready",
  "digest_ready",
]);

export const cardioPreset = pgEnum("cardio_preset", [
  "tabata",
  "norwegian_4x4",
  "emom",
  "custom",
]);

export const cardioBlockKind = pgEnum("cardio_block_kind", ["work", "rest"]);

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

export const creditTxType = pgEnum("credit_tx_type", [
  "purchase",
  "spend",
  "refund",
  "adjustment",
]);

export const creditTxRefType = pgEnum("credit_tx_ref_type", [
  "yookassa_payment",
  "ai_coach_session",
  "manual",
]);

export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "waiting_for_capture",
  "succeeded",
  "canceled",
]);
