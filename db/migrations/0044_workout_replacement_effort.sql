ALTER TABLE "workout_exercises" ADD COLUMN "replaced_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "workout_sets" ADD COLUMN "effort" text;
--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_effort_check" CHECK ("effort" IN ('near_failure', 'failure'));
