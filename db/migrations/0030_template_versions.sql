ALTER TABLE "workout_templates"
  ADD COLUMN "pinned_position" integer;
--> statement-breakpoint
ALTER TABLE "workout_templates"
  ADD COLUMN "current_version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "workout_templates_user_pinned_position_uk"
  ON "workout_templates" ("user_id", "pinned_position")
  WHERE "pinned_position" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE "template_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "template_id" text NOT NULL REFERENCES "workout_templates"("id") ON DELETE CASCADE,
  "version_number" integer NOT NULL,
  "source" text NOT NULL,
  "source_workout_id" text,
  "snapshot" jsonb NOT NULL,
  "summary" text NOT NULL,
  "rationale" text,
  "confidence" double precision,
  "requires_confirmation" boolean DEFAULT false NOT NULL,
  "confirmed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "template_versions_source_check"
    CHECK ("source" IN ('manual', 'trainer', 'rollback'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "template_versions_template_number_uk"
  ON "template_versions" ("template_id", "version_number");
--> statement-breakpoint
CREATE UNIQUE INDEX "template_versions_template_source_workout_uk"
  ON "template_versions" ("template_id", "source_workout_id")
  WHERE "source_workout_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "template_versions_template_created_idx"
  ON "template_versions" ("template_id", "created_at");
