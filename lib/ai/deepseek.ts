import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

import { env } from "@/lib/env";

/**
 * Текущий приоритет:
 *  1. Gemini, если задан GEMINI_API_KEY  — бесплатные токены + 1M контекст.
 *  2. OpenAI-совместимый gateway (VseGPT / OpenRouter / ProxyAPI и т.п.).
 *
 *  Provider можно зафиксировать через env AI_PROVIDER=gemini|openai
 *  (см. lib/env.ts). По умолчанию — gemini, если ключ есть.
 */

type Provider = "gemini" | "openai";

function resolveProvider(): Provider | null {
  const forced = env.AI_PROVIDER;
  if (forced === "gemini") return env.GEMINI_API_KEY ? "gemini" : null;
  if (forced === "openai") return env.AI_API_KEY ? "openai" : null;
  if (env.GEMINI_API_KEY) return "gemini";
  if (env.AI_API_KEY) return "openai";
  return null;
}

let _gemini: ReturnType<typeof createGoogleGenerativeAI> | null = null;
let _openai: ReturnType<typeof createOpenAI> | null = null;

function geminiClient() {
  if (!_gemini) {
    _gemini = createGoogleGenerativeAI({
      apiKey: env.GEMINI_API_KEY ?? "",
    });
  }
  return _gemini;
}

function openaiClient() {
  if (!_openai) {
    _openai = createOpenAI({
      baseURL: env.AI_BASE_URL,
      apiKey: env.AI_API_KEY ?? "",
      headers: {
        ...(env.AI_SITE_URL ? { "HTTP-Referer": env.AI_SITE_URL } : {}),
        ...(env.AI_SITE_NAME ? { "X-Title": env.AI_SITE_NAME } : {}),
      },
    });
  }
  return _openai;
}

/**
 * Унифицированная фабрика модели. Игнорирует переданный modelId
 * для провайдера, у которого modelId зашит в env (COACH_MODEL).
 */
export function aiClient(modelId: string): LanguageModel {
  const provider = resolveProvider();
  if (provider === "gemini") return geminiClient()(modelId);
  if (provider === "openai") return openaiClient()(modelId);
  throw new Error(
    "AI provider not configured. Set GEMINI_API_KEY or AI_API_KEY.",
  );
}

export const COACH_MODEL: string = (() => {
  const provider = resolveProvider();
  if (provider === "gemini") return env.GEMINI_MODEL;
  if (provider === "openai") return env.AI_MODEL;
  return env.GEMINI_MODEL;
})();

export function isAiConfigured(): boolean {
  return resolveProvider() !== null;
}
