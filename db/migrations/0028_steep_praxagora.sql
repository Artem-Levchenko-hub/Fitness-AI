CREATE TYPE "public"."myo_set_role" AS ENUM('activation', 'mini');--> statement-breakpoint
CREATE TYPE "public"."set_scheme" AS ENUM('straight', 'myo_reps');--> statement-breakpoint
ALTER TABLE "template_exercises" ADD COLUMN "set_scheme" "set_scheme" DEFAULT 'straight' NOT NULL;--> statement-breakpoint
ALTER TABLE "template_exercises" ADD COLUMN "myo_mini_sets" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "template_exercises" ADD COLUMN "myo_reps_percent" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "template_exercises" ADD COLUMN "myo_rest_seconds" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD COLUMN "set_scheme" "set_scheme" DEFAULT 'straight' NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD COLUMN "myo_mini_sets" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD COLUMN "myo_reps_percent" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD COLUMN "myo_rest_seconds" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD COLUMN "myo_role" "myo_set_role";