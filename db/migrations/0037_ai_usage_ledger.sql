CREATE TABLE "ai_usage_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"operation" text NOT NULL,
	"request_key" text NOT NULL,
	"scope_key" text,
	"status" text DEFAULT 'processing' NOT NULL,
	"bucket_start" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage_ledger" ADD CONSTRAINT "ai_usage_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_usage_ledger_request_key_unq" ON "ai_usage_ledger" USING btree ("request_key");--> statement-breakpoint
CREATE INDEX "ai_usage_ledger_quota_idx" ON "ai_usage_ledger" USING btree ("user_id","operation","bucket_start","status");--> statement-breakpoint
CREATE INDEX "ai_usage_ledger_rate_idx" ON "ai_usage_ledger" USING btree ("user_id","created_at");