ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "users" SET "is_admin" = true WHERE "email" = 'undj00x03@gmail.com';
