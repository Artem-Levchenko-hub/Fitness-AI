DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'set_scheme') THEN
    CREATE TYPE "public"."set_scheme" AS ENUM('straight', 'myo_reps');
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'myo_set_role') THEN
    CREATE TYPE "public"."myo_set_role" AS ENUM('activation', 'mini');
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE "template_exercises" ADD COLUMN IF NOT EXISTS "set_scheme" "set_scheme";--> statement-breakpoint
ALTER TABLE "template_exercises" ADD COLUMN IF NOT EXISTS "myo_reps_percent" integer;--> statement-breakpoint
ALTER TABLE "template_exercises" ADD COLUMN IF NOT EXISTS "myo_rest_seconds" integer;--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'template_exercises' AND column_name = 'myo_reps'
  ) THEN
    EXECUTE $sql$
      UPDATE "template_exercises"
      SET "set_scheme" = 'myo_reps'
      WHERE COALESCE("myo_reps", false) = true
        AND ("set_scheme" IS NULL OR "set_scheme" = 'straight')
    $sql$;
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'template_exercises' AND column_name = 'myo_mini_reps'
  ) THEN
    EXECUTE $sql$
      UPDATE "template_exercises"
      SET "myo_reps_percent" = LEAST(
        50,
        GREATEST(
          10,
          ROUND(("myo_mini_reps"::numeric * 100.0) / GREATEST("target_reps_max", 1))
        )
      )::int
      WHERE "myo_mini_reps" IS NOT NULL
        AND "target_reps_max" IS NOT NULL
        AND "target_reps_max" > 0
        AND "myo_reps_percent" IS NULL
    $sql$;
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'template_exercises' AND column_name = 'myo_mini_rest_seconds'
  ) THEN
    EXECUTE $sql$
      UPDATE "template_exercises"
      SET "myo_rest_seconds" = "myo_mini_rest_seconds"
      WHERE "myo_mini_rest_seconds" IS NOT NULL
        AND "myo_rest_seconds" IS NULL
    $sql$;
  END IF;
END $$;--> statement-breakpoint

UPDATE "template_exercises"
SET "set_scheme" = COALESCE("set_scheme", 'straight');--> statement-breakpoint
UPDATE "template_exercises"
SET "myo_reps_percent" = COALESCE("myo_reps_percent", 30);--> statement-breakpoint
UPDATE "template_exercises"
SET "myo_rest_seconds" = COALESCE("myo_rest_seconds", 30);--> statement-breakpoint

ALTER TABLE "template_exercises" ALTER COLUMN "set_scheme" SET DEFAULT 'straight';--> statement-breakpoint
ALTER TABLE "template_exercises" ALTER COLUMN "set_scheme" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "template_exercises" ALTER COLUMN "myo_reps_percent" SET DEFAULT 30;--> statement-breakpoint
ALTER TABLE "template_exercises" ALTER COLUMN "myo_reps_percent" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "template_exercises" ALTER COLUMN "myo_rest_seconds" SET DEFAULT 30;--> statement-breakpoint
ALTER TABLE "template_exercises" ALTER COLUMN "myo_rest_seconds" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "workout_exercises" ADD COLUMN IF NOT EXISTS "set_scheme" "set_scheme";--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD COLUMN IF NOT EXISTS "myo_mini_sets" integer;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD COLUMN IF NOT EXISTS "myo_reps_percent" integer;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD COLUMN IF NOT EXISTS "myo_rest_seconds" integer;--> statement-breakpoint

UPDATE "workout_exercises"
SET "set_scheme" = COALESCE("set_scheme", 'straight');--> statement-breakpoint
UPDATE "workout_exercises"
SET "myo_mini_sets" = COALESCE("myo_mini_sets", 3);--> statement-breakpoint
UPDATE "workout_exercises"
SET "myo_reps_percent" = COALESCE("myo_reps_percent", 30);--> statement-breakpoint
UPDATE "workout_exercises"
SET "myo_rest_seconds" = COALESCE("myo_rest_seconds", 30);--> statement-breakpoint

ALTER TABLE "workout_exercises" ALTER COLUMN "set_scheme" SET DEFAULT 'straight';--> statement-breakpoint
ALTER TABLE "workout_exercises" ALTER COLUMN "set_scheme" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_exercises" ALTER COLUMN "myo_mini_sets" SET DEFAULT 3;--> statement-breakpoint
ALTER TABLE "workout_exercises" ALTER COLUMN "myo_mini_sets" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_exercises" ALTER COLUMN "myo_reps_percent" SET DEFAULT 30;--> statement-breakpoint
ALTER TABLE "workout_exercises" ALTER COLUMN "myo_reps_percent" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_exercises" ALTER COLUMN "myo_rest_seconds" SET DEFAULT 30;--> statement-breakpoint
ALTER TABLE "workout_exercises" ALTER COLUMN "myo_rest_seconds" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "workout_sets" ADD COLUMN IF NOT EXISTS "myo_role" "myo_set_role";--> statement-breakpoint

UPDATE "workout_sets" ws
SET "myo_role" = CASE
  WHEN ws."set_index" = 0 THEN 'activation'::"myo_set_role"
  ELSE 'mini'::"myo_set_role"
END
FROM "workout_exercises" we
WHERE ws."workout_exercise_id" = we."id"
  AND ws."myo_role" IS NULL
  AND we."set_scheme" = 'myo_reps';--> statement-breakpoint
