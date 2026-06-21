ALTER TABLE "workout_templates" ADD COLUMN "pre_adapt_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "workout_templates" ADD COLUMN "adapted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workout_templates" ADD COLUMN "adapt_opt_out" boolean DEFAULT false NOT NULL;