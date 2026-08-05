ALTER TABLE "workout_exercises" ADD COLUMN IF NOT EXISTS "target_sets" integer;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD COLUMN IF NOT EXISTS "target_reps_min" integer;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD COLUMN IF NOT EXISTS "target_reps_max" integer;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD COLUMN IF NOT EXISTS "target_weight_kg" double precision;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD COLUMN IF NOT EXISTS "target_rest_seconds" integer;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD COLUMN IF NOT EXISTS "myo_reps" boolean;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD COLUMN IF NOT EXISTS "myo_mini_sets" integer;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD COLUMN IF NOT EXISTS "myo_mini_reps" integer;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD COLUMN IF NOT EXISTS "myo_mini_rest_seconds" integer;--> statement-breakpoint

ALTER TABLE "template_exercises" ALTER COLUMN "myo_mini_rest_seconds" SET DEFAULT 20;--> statement-breakpoint
UPDATE "template_exercises"
SET "myo_mini_rest_seconds" = LEAST(30, GREATEST(5, "myo_mini_rest_seconds"))
WHERE "myo_reps" = true;
