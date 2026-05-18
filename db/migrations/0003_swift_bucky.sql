CREATE TYPE "public"."ai_job_kind" AS ENUM('post_workout', 'daily_digest', 'on_demand');--> statement-breakpoint
CREATE TYPE "public"."push_kind" AS ENUM('sleep_reminder', 'nutrition_reminder', 'trainer_ready', 'digest_ready');--> statement-breakpoint
CREATE TABLE "body_measurements" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"measured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"weight_kg" double precision,
	"body_fat_pct" double precision,
	"waist_cm" double precision,
	"neck_cm" double precision,
	"chest_cm" double precision,
	"hip_cm" double precision,
	"arm_cm" double precision,
	"thigh_cm" double precision,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nutrition_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"kcal" integer,
	"protein_g" double precision,
	"fat_g" double precision,
	"carbs_g" double precision,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sleep_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"hours" double precision NOT NULL,
	"quality" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" "push_kind" NOT NULL,
	"payload" jsonb,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_count" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "ai_analyses" ALTER COLUMN "workout_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_jobs" ALTER COLUMN "workout_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD COLUMN "result_json" jsonb;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD COLUMN "kind" "ai_job_kind" DEFAULT 'post_workout' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD COLUMN "analysis_id" text;--> statement-breakpoint
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_entries" ADD CONSTRAINT "nutrition_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sleep_logs" ADD CONSTRAINT "sleep_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications_log" ADD CONSTRAINT "notifications_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "body_measurements_user_idx" ON "body_measurements" USING btree ("user_id","measured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "nutrition_entries_user_date_uniq" ON "nutrition_entries" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "nutrition_entries_date_idx" ON "nutrition_entries" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "sleep_logs_user_date_uniq" ON "sleep_logs" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "sleep_logs_date_idx" ON "sleep_logs" USING btree ("date");--> statement-breakpoint
CREATE INDEX "notifications_log_user_kind_idx" ON "notifications_log" USING btree ("user_id","kind","sent_at");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_jobs_user_kind_idx" ON "ai_jobs" USING btree ("user_id","kind","scheduled_at");