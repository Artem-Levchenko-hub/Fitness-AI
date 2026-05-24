CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "body_measurements" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"measured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"weight_kg" double precision,
	"body_fat_pct" double precision,
	"waist_cm" double precision,
	"neck_cm" double precision,
	"chest_cm" double precision,
	"hip_cm" double precision,
	"arm_cm" double precision,
	"thigh_cm" double precision,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(768) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"author" text,
	"domain" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"source_path" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_source_id_knowledge_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."knowledge_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "body_measurements_user_idx" ON "body_measurements" USING btree ("user_id","measured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_chunks_source_chunk_uk" ON "knowledge_chunks" USING btree ("source_id","chunk_index");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_source_idx" ON "knowledge_chunks" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_embedding_hnsw_idx" ON "knowledge_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "knowledge_sources_domain_idx" ON "knowledge_sources" USING btree ("domain");