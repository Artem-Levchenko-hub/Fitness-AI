import { createOpenAI } from "@ai-sdk/openai";

import { env } from "@/lib/env";

/** OpenAI-compat клиент. По умолчанию настроен под OpenRouter
 *  (sk-or-v1-…), но base URL можно поменять под любой совместимый
 *  gateway: OpenAI, DeepSeek прямой, Together, Groq, etc. */
export const aiClient = createOpenAI({
  baseURL: env.AI_BASE_URL,
  apiKey: env.AI_API_KEY ?? "",
  headers: {
    // OpenRouter рекомендует, но другие ignore'ят. Cosmetic only.
    ...(env.AI_SITE_URL ? { "HTTP-Referer": env.AI_SITE_URL } : {}),
    ...(env.AI_SITE_NAME ? { "X-Title": env.AI_SITE_NAME } : {}),
  },
});

export const COACH_MODEL = env.AI_MODEL;

export function isAiConfigured(): boolean {
  return !!env.AI_API_KEY && env.AI_API_KEY.length > 10;
}
