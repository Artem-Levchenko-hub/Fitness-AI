ALTER TYPE "public"."payment_status" ADD VALUE 'refund_pending' BEFORE 'refunded';--> statement-breakpoint
CREATE TABLE "ai_billing_operations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workout_id" text NOT NULL,
	"kind" text DEFAULT 'coach_reply' NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"coverage" text NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"price_kopecks" integer DEFAULT 0 NOT NULL,
	"charged_at" timestamp with time zone,
	"response_text" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refund_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refund_requested_by" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refund_reason" text;--> statement-breakpoint
ALTER TABLE "ai_billing_operations" ADD CONSTRAINT "ai_billing_operations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_billing_ops_user_created_idx" ON "ai_billing_operations" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_billing_ops_status_updated_idx" ON "ai_billing_operations" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_initial_subscription_inflight_unq" ON "payments" USING btree ("user_id") WHERE "payments"."kind" = 'subscription_initial' and "payments"."status" in ('pending', 'waiting_for_capture');--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_tx_reference_pair_chk" CHECK (("credit_transactions"."reference_type" is null) = ("credit_transactions"."reference_id" is null));