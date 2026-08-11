CREATE TABLE "ai_quota_exchanges" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"bucket_start" timestamp with time zone NOT NULL,
	"coach_replies_spent" integer NOT NULL,
	"post_workout_analyses_added" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage_ledger" ADD COLUMN "counts_toward_quota" boolean;--> statement-breakpoint
CREATE FUNCTION "public"."set_ai_usage_quota_coverage"() RETURNS trigger AS $$
BEGIN
	IF NEW."counts_toward_quota" IS NULL THEN
		IF NEW."operation" <> 'coach_reply' THEN
			NEW."counts_toward_quota" := true;
		ELSE
			NEW."counts_toward_quota" := EXISTS (
				SELECT 1
				FROM "public"."subscriptions" AS "subscription"
				WHERE "subscription"."user_id" = NEW."user_id"
					AND "subscription"."tier" = 'pro'
					AND "subscription"."status" IN ('active', 'trialing')
					AND ("subscription"."current_period_start" IS NULL OR "subscription"."current_period_start" <= COALESCE(NEW."created_at", CURRENT_TIMESTAMP))
					AND "subscription"."current_period_end" > COALESCE(NEW."created_at", CURRENT_TIMESTAMP)
			);
		END IF;
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "ai_usage_quota_coverage_before_insert"
BEFORE INSERT ON "ai_usage_ledger"
FOR EACH ROW EXECUTE FUNCTION "public"."set_ai_usage_quota_coverage"();--> statement-breakpoint
UPDATE "ai_usage_ledger" AS "usage"
SET "counts_toward_quota" = true
WHERE "usage"."operation" <> 'coach_reply';--> statement-breakpoint
UPDATE "ai_usage_ledger"
SET "counts_toward_quota" = false
WHERE "operation" = 'coach_reply';--> statement-breakpoint
UPDATE "ai_usage_ledger" AS "usage"
SET "counts_toward_quota" = true
FROM "ai_billing_operations" AS "billing"
WHERE "usage"."operation" = 'coach_reply'
	AND "billing"."coverage" = 'subscription'
	AND "usage"."request_key" = 'coach:' || "billing"."id";--> statement-breakpoint
ALTER TABLE "ai_usage_ledger" ALTER COLUMN "counts_toward_quota" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_quota_exchanges" ADD CONSTRAINT "ai_quota_exchanges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_quota_exchanges_user_bucket_unq" ON "ai_quota_exchanges" USING btree ("user_id","bucket_start");
