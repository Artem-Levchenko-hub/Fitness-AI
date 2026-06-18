ALTER TABLE "circuit_workouts" ADD COLUMN "source_template_id" text;--> statement-breakpoint
ALTER TABLE "circuit_templates" ADD COLUMN "last_adapted_circuit_workout_id" text;