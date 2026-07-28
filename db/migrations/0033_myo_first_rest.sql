ALTER TABLE "template_exercises"
  ADD COLUMN "myo_first_rest_seconds" integer DEFAULT 40 NOT NULL;
--> statement-breakpoint
ALTER TABLE "workout_exercises"
  ADD COLUMN "myo_first_rest_seconds" integer DEFAULT 40 NOT NULL;
--> statement-breakpoint
ALTER TABLE "quick_activities"
  ADD COLUMN "myo_first_rest_seconds" integer;
