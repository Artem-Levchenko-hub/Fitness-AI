CREATE UNIQUE INDEX "exercises_system_slug_unq"
  ON "exercises" ("slug")
  WHERE "owner_user_id" IS NULL;
