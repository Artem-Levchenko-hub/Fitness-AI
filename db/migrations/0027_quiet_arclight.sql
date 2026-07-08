ALTER TABLE "training_programs" ADD COLUMN "review_json" jsonb;--> statement-breakpoint
ALTER TABLE "training_programs" ADD COLUMN "reviewed_at" timestamp with time zone;