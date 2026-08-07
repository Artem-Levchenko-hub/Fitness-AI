import { embed, embedMany } from "ai";

import { aiEmbeddingModel } from "@/lib/ai/deepseek";

const BATCH_SIZE = 64;

/** Эмбеддит массив строк через OpenAI-совместимый gateway и
 *  text-embedding-3-small
 *  (1536 dim). Батчит по 64 за раз. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const model = aiEmbeddingModel();
  const result: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const { embeddings } = await embedMany({ model, values: batch });
    result.push(...embeddings);
  }
  return result;
}

/** Эмбеддит одну строку (для retrieve query). */
export async function embedQuery(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: aiEmbeddingModel(),
    value: text,
  });
  return embedding;
}
