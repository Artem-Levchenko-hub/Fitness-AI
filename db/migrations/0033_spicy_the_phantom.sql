ALTER TYPE "public"."payment_status" ADD VALUE 'failed';--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'refunded';--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "stripe_customer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "provider" text DEFAULT 'stripe' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "provider" SET DEFAULT 'yookassa';--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "provider_payment_method_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "plan_code" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "price_kopecks" integer;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "current_period_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "next_charge_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "canceled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "recurring_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "recurring_consent_version" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "last_payment_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
UPDATE "payments" SET "idempotency_key" = "id" WHERE "idempotency_key" IS NULL;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "idempotency_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "kind" text DEFAULT 'topup' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "plan_code" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "receipt_email" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "recurring_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "recurring_consent_version" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "customer_ip" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "customer_user_agent" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "period_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "period_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "canceled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "failure_code" text;--> statement-breakpoint
CREATE INDEX "subscriptions_next_charge_idx" ON "subscriptions" USING btree ("next_charge_at","status");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_provider_method_unq" ON "subscriptions" USING btree ("provider","provider_payment_method_id") WHERE "subscriptions"."provider_payment_method_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "credit_tx_reference_type_unq" ON "credit_transactions" USING btree ("user_id","reference_type","reference_id","type") WHERE "credit_transactions"."reference_type" is not null and "credit_transactions"."reference_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_idempotency_key_unq" ON "payments" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "payments_kind_idx" ON "payments" USING btree ("kind","created_at");
