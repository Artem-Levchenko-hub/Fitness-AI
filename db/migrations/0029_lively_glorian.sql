ALTER TABLE "template_exercises" ADD COLUMN "myo_reps" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "template_exercises" ADD COLUMN "myo_mini_sets" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "template_exercises" ADD COLUMN "myo_mini_reps" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "template_exercises" ADD COLUMN "myo_mini_rest_seconds" integer DEFAULT 15 NOT NULL;