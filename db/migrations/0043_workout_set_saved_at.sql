ALTER TABLE "workout_sets" ADD COLUMN "saved_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "workout_sets" SET "saved_at" = "completed_at";
--> statement-breakpoint
ALTER TABLE "workout_sets" ALTER COLUMN "saved_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "workout_sets" ALTER COLUMN "saved_at" SET NOT NULL;
