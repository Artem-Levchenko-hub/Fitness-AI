-- G7c run-2 foundation: заметка «как прошло» на кардио-сессии.
-- Добавляет nullable `notes` на cardio_workouts (как workouts.notes /
-- circuit_workouts.notes — feeling-note после завершения, AI читает целиком).
-- Foundation-слайс: НИЧЕГО пока не читает/не пишет столбец (нулевое изменение
-- поведения). Аддитивно, обратимо (DROP COLUMN). Идемпотентно (IF NOT EXISTS) —
-- безопасно повторно. Применяется на прод через psql (НЕ db:migrate —
-- circuit snapshot-дрифт пере-создал бы circuit-таблицы), pg_dump бэкап ПЕРЕД.
ALTER TABLE "cardio_workouts"
  ADD COLUMN IF NOT EXISTS "notes" text;
