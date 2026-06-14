CREATE TYPE "public"."goal_kind" AS ENUM('weight', '1rm', 'frequency');--> statement-breakpoint
CREATE TABLE "goals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"exercise_id" text,
	"muscle_group_key" "muscle_group_key",
	"kind" "goal_kind" NOT NULL,
	"target_value" double precision NOT NULL,
	"target_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_muscle_group_key_muscle_groups_key_fk" FOREIGN KEY ("muscle_group_key") REFERENCES "public"."muscle_groups"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goals_user_idx" ON "goals" USING btree ("user_id");