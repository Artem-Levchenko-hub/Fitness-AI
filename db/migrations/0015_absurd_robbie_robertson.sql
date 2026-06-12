CREATE TABLE "circuit_template_exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"circuit_template_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"order_idx" integer NOT NULL,
	"kind" "circuit_exercise_kind" NOT NULL,
	"target_reps" integer,
	"target_duration_sec" integer,
	"target_weight_kg" double precision,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "circuit_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"total_rounds" integer DEFAULT 3 NOT NULL,
	"rest_between_rounds_sec" integer DEFAULT 60 NOT NULL,
	"rest_between_exercises_sec" integer DEFAULT 15 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "circuit_template_exercises" ADD CONSTRAINT "circuit_template_exercises_circuit_template_id_circuit_templates_id_fk" FOREIGN KEY ("circuit_template_id") REFERENCES "public"."circuit_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circuit_template_exercises" ADD CONSTRAINT "circuit_template_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circuit_templates" ADD CONSTRAINT "circuit_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "circuit_template_exercises_template_idx" ON "circuit_template_exercises" USING btree ("circuit_template_id","order_idx");--> statement-breakpoint
CREATE INDEX "circuit_template_exercises_exercise_idx" ON "circuit_template_exercises" USING btree ("exercise_id");--> statement-breakpoint
CREATE INDEX "circuit_templates_user_idx" ON "circuit_templates" USING btree ("user_id");