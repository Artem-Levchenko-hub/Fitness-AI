-- F4-incr.2b: флаг bodyweight-упражнений (вес тела + добавка).
-- Идемпотентно (IF NOT EXISTS + WHERE slug IN) — безопасно повторно.
-- Применяется на прод через psql (НЕ db:migrate — circuit snapshot-дрифт),
-- pg_dump бэкап ПЕРЕД. Аддитивно, обратимо (DROP COLUMN).
ALTER TABLE "exercises"
  ADD COLUMN IF NOT EXISTS "is_bodyweight" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "exercises"
SET "is_bodyweight" = true
WHERE "owner_user_id" IS NULL
  AND "slug" IN ('pull-up', 'chin-up', 'dips-chest', 'dips-triceps', 'push-up');
