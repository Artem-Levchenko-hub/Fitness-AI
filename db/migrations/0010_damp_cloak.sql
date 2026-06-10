CREATE TYPE "public"."circuit_exercise_kind" AS ENUM('reps', 'duration');--> statement-breakpoint
ALTER TYPE "public"."ai_job_kind" ADD VALUE 'circuit_post_workout';--> statement-breakpoint
CREATE TABLE "circuit_exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"circuit_workout_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"order_idx" integer NOT NULL,
	"kind" "circuit_exercise_kind" NOT NULL,
	"target_reps" integer,
	"target_duration_sec" integer,
	"target_weight_kg" double precision,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "circuit_round_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"circuit_workout_id" text NOT NULL,
	"circuit_exercise_id" text NOT NULL,
	"round_number" integer NOT NULL,
	"actual_reps" integer,
	"actual_duration_sec" integer,
	"actual_weight_kg" double precision,
	"rpe" double precision,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"skipped" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "circuit_workouts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"total_rounds" integer DEFAULT 3 NOT NULL,
	"rest_between_rounds_sec" integer DEFAULT 60 NOT NULL,
	"rest_between_exercises_sec" integer DEFAULT 15 NOT NULL,
	"status" "workout_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD COLUMN "circuit_workout_id" text;--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD COLUMN "circuit_workout_id" text;--> statement-breakpoint
ALTER TABLE "circuit_exercises" ADD CONSTRAINT "circuit_exercises_circuit_workout_id_circuit_workouts_id_fk" FOREIGN KEY ("circuit_workout_id") REFERENCES "public"."circuit_workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circuit_exercises" ADD CONSTRAINT "circuit_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circuit_round_logs" ADD CONSTRAINT "circuit_round_logs_circuit_workout_id_circuit_workouts_id_fk" FOREIGN KEY ("circuit_workout_id") REFERENCES "public"."circuit_workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circuit_round_logs" ADD CONSTRAINT "circuit_round_logs_circuit_exercise_id_circuit_exercises_id_fk" FOREIGN KEY ("circuit_exercise_id") REFERENCES "public"."circuit_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circuit_workouts" ADD CONSTRAINT "circuit_workouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "circuit_exercises_workout_idx" ON "circuit_exercises" USING btree ("circuit_workout_id","order_idx");--> statement-breakpoint
CREATE INDEX "circuit_exercises_exercise_idx" ON "circuit_exercises" USING btree ("exercise_id");--> statement-breakpoint
CREATE INDEX "circuit_round_logs_workout_round_idx" ON "circuit_round_logs" USING btree ("circuit_workout_id","round_number");--> statement-breakpoint
CREATE INDEX "circuit_round_logs_exercise_round_idx" ON "circuit_round_logs" USING btree ("circuit_exercise_id","round_number");--> statement-breakpoint
CREATE INDEX "circuit_workouts_user_started_idx" ON "circuit_workouts" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "circuit_workouts_user_status_idx" ON "circuit_workouts" USING btree ("user_id","status");--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_circuit_workout_id_circuit_workouts_id_fk" FOREIGN KEY ("circuit_workout_id") REFERENCES "public"."circuit_workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_circuit_workout_id_circuit_workouts_id_fk" FOREIGN KEY ("circuit_workout_id") REFERENCES "public"."circuit_workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_analyses_circuit_workout_idx" ON "ai_analyses" USING btree ("circuit_workout_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_analyses_share_token_unq" ON "ai_analyses" USING btree ("share_token");--> statement-breakpoint
CREATE INDEX "ai_jobs_circuit_workout_idx" ON "ai_jobs" USING btree ("circuit_workout_id");