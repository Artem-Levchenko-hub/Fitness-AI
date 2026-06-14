CREATE TYPE "public"."template_source" AS ENUM('manual', 'trainer');--> statement-breakpoint
ALTER TABLE "workout_templates" ADD COLUMN "source" "template_source" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_templates" ADD COLUMN "source_workout_id" text;