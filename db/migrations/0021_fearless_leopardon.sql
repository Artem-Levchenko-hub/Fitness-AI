CREATE TABLE "training_programs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"library_slug" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workout_templates" ADD COLUMN "program_id" text;--> statement-breakpoint
ALTER TABLE "workout_templates" ADD COLUMN "day_order" integer;--> statement-breakpoint
ALTER TABLE "workout_templates" ADD COLUMN "last_adapted_workout_id" text;--> statement-breakpoint
ALTER TABLE "training_programs" ADD CONSTRAINT "training_programs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "training_programs_user_idx" ON "training_programs" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "workout_templates" ADD CONSTRAINT "workout_templates_program_id_training_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."training_programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workout_templates_program_idx" ON "workout_templates" USING btree ("program_id","day_order");