ALTER TYPE "public"."quick_activity_mode" ADD VALUE IF NOT EXISTS 'myo_reps';--> statement-breakpoint
ALTER TABLE "quick_activities" ADD COLUMN IF NOT EXISTS "myo_mini_sets" integer;--> statement-breakpoint
ALTER TABLE "quick_activities" ADD COLUMN IF NOT EXISTS "myo_mini_reps" integer;
