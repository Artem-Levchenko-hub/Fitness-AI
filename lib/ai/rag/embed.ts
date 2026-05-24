import { embed, embedMany } from "ai";

import { gemini, GEMINI_EMBEDDING_MODEL } from "@/lib/ai/gemini";

const BATCH_SIZE = 64;

/** Эмбеддит массив строк через Gemini text-embedding-004 (768 dim).
 *  Батчит по 64 за раз — Gemini API лимит 100 docs/request. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const result: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const { embeddings } = await embedMany({
      model: gemini.textEmbeddingModel(GEMINI_EMBEDDING_MODEL),
      values: batch,
    });
    result.push(...embeddings);
  }
  return result;
}

/** Эмбеддит одну строку (для retrieve query). */
export async function embedQuery(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: gemini.textEmbeddingModel(GEMINI_EMBEDDING_MODEL),
    value: text,
  });
  return embedding;
}
