CREATE TYPE "public"."ai_job_status" AS ENUM('pending', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."experience_level" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('ru', 'en');--> statement-breakpoint
CREATE TYPE "public"."muscle_group_key" AS ENUM('chest', 'back_lats', 'back_traps', 'shoulders_front', 'shoulders_side', 'shoulders_rear', 'biceps', 'triceps', 'forearms', 'core', 'glutes', 'quads', 'hamstrings', 'calves');--> statement-breakpoint
CREATE TYPE "public"."muscle_role" AS ENUM('primary', 'secondary');--> statement-breakpoint
CREATE TYPE "public"."note_entity_type" AS ENUM('exercise', 'workout', 'cycle');--> statement-breakpoint
CREATE TYPE "public"."note_source" AS ENUM('manual', 'auto_generated');--> statement-breakpoint
CREATE TYPE "public"."set_type" AS ENUM('working', 'warmup', 'drop', 'failure');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'paused');--> statement-breakpoint
CREATE TYPE "public"."subscription_tier" AS ENUM('free', 'pro');--> statement-breakpoint
CREATE TYPE "public"."weight_unit" AS ENUM('kg', 'lb');--> statement-breakpoint
CREATE TYPE "public"."workout_status" AS ENUM('active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"image" text,
	"weight_unit_pref" "weight_unit" DEFAULT 'kg' NOT NULL,
	"timezone" text DEFAULT 'Europe/Moscow' NOT NULL,
	"experience" "experience_level" DEFAULT 'intermediate' NOT NULL,
	"locale" "locale" DEFAULT 'ru' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "exercise_muscle_groups" (
	"exercise_id" text NOT NULL,
	"muscle_group_key" "muscle_group_key" NOT NULL,
	"role" "muscle_role" NOT NULL,
	CONSTRAINT "exercise_muscle_groups_exercise_id_muscle_group_key_role_pk" PRIMARY KEY("exercise_id","muscle_group_key","role")
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_ru" text NOT NULL,
	"name_en" text NOT NULL,
	"description" text,
	"is_custom" boolean DEFAULT false NOT NULL,
	"owner_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "muscle_groups" (
	"key" "muscle_group_key" PRIMARY KEY NOT NULL,
	"name_ru" text NOT NULL,
	"name_en" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"position" integer NOT NULL,
	"target_sets" integer DEFAULT 3 NOT NULL,
	"target_reps_min" integer DEFAULT 8 NOT NULL,
	"target_reps_max" integer DEFAULT 12 NOT NULL,
	"target_weight_kg" double precision,
	"target_rest_seconds" integer DEFAULT 120 NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "workout_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"workout_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"position" integer NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "workout_sets" (
	"id" text PRIMARY KEY NOT NULL,
	"workout_exercise_id" text NOT NULL,
	"set_index" integer NOT NULL,
	"set_type" "set_type" DEFAULT 'working' NOT NULL,
	"weight_kg" double precision NOT NULL,
	"reps" integer NOT NULL,
	"rpe" double precision,
	"rest_seconds" integer,
	"completed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"template_id" text,
	"name" text NOT NULL,
	"status" "workout_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"total_duration_seconds" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cycle_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"week_iso" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"source" "note_source" DEFAULT 'auto_generated' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"source" "note_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workout_id" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"source" "note_source" DEFAULT 'auto_generated' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_analyses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workout_id" text NOT NULL,
	"content" text NOT NULL,
	"model_version" text NOT NULL,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workout_id" text NOT NULL,
	"status" "ai_job_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"scheduled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"user_id" text PRIMARY KEY NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"tier" "subscription_tier" DEFAULT 'free' NOT NULL,
	"status" "subscription_status",
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscle_groups" ADD CONSTRAINT "exercise_muscle_groups_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_exercises" ADD CONSTRAINT "template_exercises_template_id_workout_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workout_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_exercises" ADD CONSTRAINT "template_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_templates" ADD CONSTRAINT "workout_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_workout_exercise_id_workout_exercises_id_fk" FOREIGN KEY ("workout_exercise_id") REFERENCES "public"."workout_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_template_id_workout_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workout_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_notes" ADD CONSTRAINT "cycle_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_notes" ADD CONSTRAINT "exercise_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_notes" ADD CONSTRAINT "exercise_notes_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_notes" ADD CONSTRAINT "workout_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_notes" ADD CONSTRAINT "workout_notes_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "exercise_muscle_groups_muscle_idx" ON "exercise_muscle_groups" USING btree ("muscle_group_key");--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_slug_owner_unq" ON "exercises" USING btree ("slug","owner_user_id");--> statement-breakpoint
CREATE INDEX "exercises_owner_idx" ON "exercises" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "template_exercises_template_idx" ON "template_exercises" USING btree ("template_id","position");--> statement-breakpoint
CREATE INDEX "workout_templates_user_idx" ON "workout_templates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workout_exercises_workout_idx" ON "workout_exercises" USING btree ("workout_id","position");--> statement-breakpoint
CREATE INDEX "workout_exercises_exercise_idx" ON "workout_exercises" USING btree ("exercise_id");--> statement-breakpoint
CREATE INDEX "workout_sets_we_idx" ON "workout_sets" USING btree ("workout_exercise_id","set_index");--> statement-breakpoint
CREATE INDEX "workout_sets_completed_idx" ON "workout_sets" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "workouts_user_idx" ON "workouts" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "workouts_status_idx" ON "workouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cycle_notes_user_week_idx" ON "cycle_notes" USING btree ("user_id","week_iso");--> statement-breakpoint
CREATE INDEX "exercise_notes_user_idx" ON "exercise_notes" USING btree ("user_id","exercise_id");--> statement-breakpoint
CREATE INDEX "exercise_notes_updated_idx" ON "exercise_notes" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "workout_notes_user_idx" ON "workout_notes" USING btree ("user_id","workout_id");--> statement-breakpoint
CREATE INDEX "ai_analyses_user_idx" ON "ai_analyses" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_analyses_workout_idx" ON "ai_analyses" USING btree ("workout_id");--> statement-breakpoint
CREATE INDEX "ai_jobs_status_scheduled_idx" ON "ai_jobs" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "ai_jobs_workout_idx" ON "ai_jobs" USING btree ("workout_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");