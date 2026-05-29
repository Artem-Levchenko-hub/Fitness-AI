import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";

/** Источник знаний (книга, статья, методичка). Один source — много chunks.
 *  Domain — для intent-routing retrieval (training/nutrition/sleep/psychology). */
export const knowledgeSources = pgTable(
  "knowledge_sources",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    author: text("author"),
    domain: text("domain").notNull(),
    language: text("language").notNull().default("en"),
    sourcePath: text("source_path"),
    addedAt: timestamp("added_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("knowledge_sources_domain_idx").on(t.domain)],
);

/** Фрагмент текста источника (chunk) + его эмбеддинг для cosine-поиска.
 *  vector(1536) — VseGPT emb-openai/text-embedding-3-small размерность.
 *  ВАЖНО: размерность обязана совпадать с AI_EMBED_MODEL (см. lib/ai/deepseek.ts
 *  EMBED_DIM). Сменишь embed-модель — мигрируй колонку и переэмбедь книги. */
export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sourceId: text("source_id")
      .notNull()
      .references(() => knowledgeSources.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    metadata: jsonb("metadata").$type<{
      page?: number;
      section?: string;
      headings?: string[];
      charStart?: number;
      charEnd?: number;
    }>(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("knowledge_chunks_source_chunk_uk").on(
      t.sourceId,
      t.chunkIndex,
    ),
    index("knowledge_chunks_source_idx").on(t.sourceId),
    index("knowledge_chunks_embedding_hnsw_idx")
      .using("hnsw", sql`${t.embedding} vector_cosine_ops`),
  ],
);

export const knowledgeSourcesRelations = relations(
  knowledgeSources,
  ({ many }) => ({
    chunks: many(knowledgeChunks),
  }),
);

export const knowledgeChunksRelations = relations(
  knowledgeChunks,
  ({ one }) => ({
    source: one(knowledgeSources, {
      fields: [knowledgeChunks.sourceId],
      references: [knowledgeSources.id],
    }),
  }),
);

export type KnowledgeSource = typeof knowledgeSources.$inferSelect;
export type NewKnowledgeSource = typeof knowledgeSources.$inferInsert;
export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;
export type NewKnowledgeChunk = typeof knowledgeChunks.$inferInsert;

export const KNOWLEDGE_DOMAINS = [
  "training",
  "nutrition",
  "sleep",
  "psychology",
] as const;
export type KnowledgeDomain = (typeof KNOWLEDGE_DOMAINS)[number];
