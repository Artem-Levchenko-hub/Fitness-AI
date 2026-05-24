import { asc, cosineDistance, inArray, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { knowledgeChunks, knowledgeSources } from "@/db/schema/knowledge";
import type { KnowledgeDomain } from "@/db/schema/knowledge";
import { embedQuery } from "@/lib/ai/rag/embed";

export type RetrievedChunk = {
  content: string;
  similarity: number;
  sourceTitle: string;
  sourceAuthor: string | null;
  page: number | null;
  section: string | null;
};

type RetrieveOpts = {
  topK?: number;
  minSimilarity?: number;
  domains?: KnowledgeDomain[];
};

/** Cosine-поиск релевантных chunks. Возвращает отсортированные по
 *  similarity (1 = идентично, 0 = ортогонально). minSimilarity отсекает
 *  шум — если retrieved нерелевантно, LLM скажет "в литературе нет ответа". */
export async function retrieveRelevant(
  query: string,
  opts: RetrieveOpts = {},
): Promise<RetrievedChunk[]> {
  const topK = opts.topK ?? 6;
  const minSimilarity = opts.minSimilarity ?? 0.35;

  const queryVec = await embedQuery(query);

  const similarity = sql<number>`1 - (${cosineDistance(knowledgeChunks.embedding, queryVec)})`;

  const rows = await db
    .select({
      content: knowledgeChunks.content,
      similarity,
      metadata: knowledgeChunks.metadata,
      sourceId: knowledgeChunks.sourceId,
    })
    .from(knowledgeChunks)
    .where(
      opts.domains && opts.domains.length > 0
        ? inArray(
            knowledgeChunks.sourceId,
            db
              .select({ id: knowledgeSources.id })
              .from(knowledgeSources)
              .where(inArray(knowledgeSources.domain, opts.domains)),
          )
        : undefined,
    )
    .orderBy(asc(cosineDistance(knowledgeChunks.embedding, queryVec)))
    .limit(topK);

  const filtered = rows.filter((r) => r.similarity >= minSimilarity);
  if (filtered.length === 0) return [];

  const sourceIds = [...new Set(filtered.map((r) => r.sourceId))];
  const sourcesArr = await db
    .select({
      id: knowledgeSources.id,
      title: knowledgeSources.title,
      author: knowledgeSources.author,
    })
    .from(knowledgeSources)
    .where(inArray(knowledgeSources.id, sourceIds));
  const sourcesById = new Map(sourcesArr.map((s) => [s.id, s]));

  return filtered.map((r) => {
    const src = sourcesById.get(r.sourceId);
    return {
      content: r.content,
      similarity: Number(r.similarity),
      sourceTitle: src?.title ?? "?",
      sourceAuthor: src?.author ?? null,
      page: r.metadata?.page ?? null,
      section: r.metadata?.section ?? null,
    };
  });
}

/** Форматирует retrieved chunks в markdown для инжекта в system prompt. */
export function formatRetrievedChunks(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return "_(в загруженной базе знаний нет релевантных фрагментов по запросу)_";
  }
  return chunks
    .map((c, i) => {
      const cite = c.sourceAuthor
        ? `${c.sourceAuthor}, "${c.sourceTitle}"`
        : `"${c.sourceTitle}"`;
      const loc = c.page != null ? `, с. ${c.page}` : "";
      const sec = c.section ? ` · ${c.section}` : "";
      return `### [${i + 1}] ${cite}${loc}${sec} _(sim=${c.similarity.toFixed(2)})_\n\n${c.content}`;
    })
    .join("\n\n---\n\n");
}
