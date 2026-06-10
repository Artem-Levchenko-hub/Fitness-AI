-- G7a foundation: привязка расписания к КОНКРЕТНОЙ заготовке тренировки.
-- Три nullable FK (R-29: отдельные столбцы вместо полиморфного type+id):
--   template_id        -> workout_templates (силовая)
--   circuit_workout_id -> circuit_workouts   (круговая)
--   cardio_workout_id  -> cardio_workouts    (кардио)
-- ON DELETE SET NULL: удалили заготовку → расписание остаётся «свободным».
-- Foundation-слайс: НИЧЕГО пока не читает эти столбцы (нулевое изменение
-- поведения). Аддитивно, обратимо (DROP COLUMN). Идемпотентно (IF NOT EXISTS +
-- DO/EXCEPTION) — безопасно повторно. Применяется на прод через psql
-- (НЕ db:migrate — circuit snapshot-дрифт), pg_dump бэкап ПЕРЕД.
ALTER TABLE "workout_schedules"
  ADD COLUMN IF NOT EXISTS "template_id" text;
--> statement-breakpoint
ALTER TABLE "workout_schedules"
  ADD COLUMN IF NOT EXISTS "circuit_workout_id" text;
--> statement-breakpoint
ALTER TABLE "workout_schedules"
  ADD COLUMN IF NOT EXISTS "cardio_workout_id" text;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "workout_schedules"
    ADD CONSTRAINT "workout_schedules_template_id_workout_templates_id_fk"
    FOREIGN KEY ("template_id") REFERENCES "public"."workout_templates"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "workout_schedules"
    ADD CONSTRAINT "workout_schedules_circuit_workout_id_circuit_workouts_id_fk"
    FOREIGN KEY ("circuit_workout_id") REFERENCES "public"."circuit_workouts"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "workout_schedules"
    ADD CONSTRAINT "workout_schedules_cardio_workout_id_cardio_workouts_id_fk"
    FOREIGN KEY ("cardio_workout_id") REFERENCES "public"."cardio_workouts"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
