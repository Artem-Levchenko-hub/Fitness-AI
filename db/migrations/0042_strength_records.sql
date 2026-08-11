CREATE TABLE "strength_records" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"movement" text NOT NULL,
	"value" double precision NOT NULL,
	"performed_at" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "strength_records_movement_check" CHECK ("strength_records"."movement" in ('pull_up', 'back_squat', 'bench_press')),
	CONSTRAINT "strength_records_value_check" CHECK ("strength_records"."value" >= 1),
	CONSTRAINT "strength_records_value_format_check" CHECK (("strength_records"."movement" = 'pull_up' and "strength_records"."value" <= 200 and "strength_records"."value" = trunc("strength_records"."value")) or ("strength_records"."movement" <> 'pull_up' and "strength_records"."value" <= 1000 and "strength_records"."value" * 2 = trunc("strength_records"."value" * 2)))
);
--> statement-breakpoint
ALTER TABLE "strength_records" ADD CONSTRAINT "strength_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "strength_records_user_movement_date_idx" ON "strength_records" USING btree ("user_id","movement","performed_at");
