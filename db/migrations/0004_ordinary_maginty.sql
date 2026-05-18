CREATE TYPE "public"."cardio_block_kind" AS ENUM('work', 'rest');--> statement-breakpoint
CREATE TYPE "public"."cardio_preset" AS ENUM('tabata', 'norwegian_4x4', 'emom', 'custom');--> statement-breakpoint
CREATE TABLE "cardio_blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"cardio_workout_id" text NOT NULL,
	"block_index" integer NOT NULL,
	"kind" "cardio_block_kind" NOT NULL,
	"label" text NOT NULL,
	"planned_duration_sec" integer NOT NULL,
	"actual_duration_sec" integer,
	"hr_avg" integer,
	"rpe" double precision,
	"notes" text,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cardio_workouts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"preset" "cardio_preset" DEFAULT 'custom' NOT NULL,
	"plan_json" jsonb,
	"status" "workout_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "cardio_blocks" ADD CONSTRAINT "cardio_blocks_cardio_workout_id_cardio_workouts_id_fk" FOREIGN KEY ("cardio_workout_id") REFERENCES "public"."cardio_workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardio_workouts" ADD CONSTRAINT "cardio_workouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cardio_blocks_workout_idx" ON "cardio_blocks" USING btree ("cardio_workout_id","block_index");--> statement-breakpoint
CREATE INDEX "cardio_workouts_user_started_idx" ON "cardio_workouts" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "cardio_workouts_user_status_idx" ON "cardio_workouts" USING btree ("user_id","status");