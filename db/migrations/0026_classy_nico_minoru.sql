CREATE TYPE "public"."quick_activity_mode" AS ENUM('sets', 'total');--> statement-breakpoint
CREATE TABLE "quick_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"mode" "quick_activity_mode" DEFAULT 'sets' NOT NULL,
	"reps" integer NOT NULL,
	"weight_kg" double precision,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quick_activities" ADD CONSTRAINT "quick_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_activities" ADD CONSTRAINT "quick_activities_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quick_activities_user_performed_idx" ON "quick_activities" USING btree ("user_id","performed_at");--> statement-breakpoint
CREATE INDEX "quick_activities_exercise_idx" ON "quick_activities" USING btree ("exercise_id");