import { createGoogleGenerativeAI } from "@ai-sdk/google";

import { env } from "@/lib/env";

/** Google Gemini клиент. Используется для chat (gemini-2.5-flash/pro)
 *  и embeddings (text-embedding-004, 768 dim). Free tier: 50 req/day. */
export const gemini = createGoogleGenerativeAI({
  apiKey: env.GEMINI_API_KEY ?? "",
});

export const GEMINI_CHAT_MODEL = env.GEMINI_MODEL;
export const GEMINI_EMBEDDING_MODEL = "text-embedding-004";
export const GEMINI_EMBEDDING_DIM = 768;

export function isGeminiConfigured(): boolean {
  return !!env.GEMINI_API_KEY && env.GEMINI_API_KEY.length > 10;
}
