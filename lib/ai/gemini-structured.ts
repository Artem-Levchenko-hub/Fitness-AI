import { GoogleGenAI, Type } from "@google/genai";
import { ProxyAgent, setGlobalDispatcher } from "undici";

import { env } from "@/lib/env";

/** ProxyAgent ставим один раз на процесс. Если HTTPS_PROXY не задан —
 *  undici работает напрямую (для dev-машин вне РФ это нормально). */
let proxyConfigured = false;
function ensureProxy(): void {
  if (proxyConfigured) return;
  if (env.HTTPS_PROXY) {
    setGlobalDispatcher(new ProxyAgent(env.HTTPS_PROXY));
  }
  proxyConfigured = true;
}

/** Singleton Google GenAI client. Создаём лениво — env-зависимости должны
 *  быть провалидированы перед первым вызовом. */
let _client: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  ensureProxy();
  if (!_client) {
    _client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }
  return _client;
}

export const TRAINER_MODEL = env.GEMINI_MODEL;

export type TrainerResponse = {
  overallScore: number;
  trainingQuality: { score: number; comment: string };
  recoveryContext: { score: number | null; comment: string };
  nutritionContext: { score: number | null; comment: string };
  recommendations: string[];
  nextSessionFocus: string;
  missingDataAdvice: string | null;
  motivation: string;
};

/** Strict JSON schema для responseSchema — Gemini уважает required+type. */
export const TRAINER_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    overallScore: {
      type: Type.INTEGER,
      description: "Общая оценка тренировки 0..100. Если данных мало — занижай.",
    },
    trainingQuality: {
      type: Type.OBJECT,
      properties: {
        score: { type: Type.INTEGER, description: "0..100" },
        comment: { type: Type.STRING, description: "1-2 предложения на русском" },
      },
      required: ["score", "comment"],
    },
    recoveryContext: {
      type: Type.OBJECT,
      properties: {
        score: {
          type: Type.INTEGER,
          nullable: true,
          description: "0..100 если есть данные о сне, иначе null",
        },
        comment: { type: Type.STRING },
      },
      required: ["score", "comment"],
    },
    nutritionContext: {
      type: Type.OBJECT,
      properties: {
        score: {
          type: Type.INTEGER,
          nullable: true,
          description: "0..100 если есть данные о КБЖУ, иначе null",
        },
        comment: { type: Type.STRING },
      },
      required: ["score", "comment"],
    },
    recommendations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3-5 конкретных шагов на следующую сессию",
    },
    nextSessionFocus: {
      type: Type.STRING,
      description: "Одна фраза — что в следующей тренировке поставить главным",
    },
    missingDataAdvice: {
      type: Type.STRING,
      nullable: true,
      description:
        "Если сон/КБЖУ не заполнены — что именно записать для лучшего разбора. null если всё есть.",
    },
    motivation: {
      type: Type.STRING,
      description: "Одна мотивирующая фраза в стиле тренера. На «ты». Кратко.",
    },
  },
  required: [
    "overallScore",
    "trainingQuality",
    "recoveryContext",
    "nutritionContext",
    "recommendations",
    "nextSessionFocus",
    "missingDataAdvice",
    "motivation",
  ],
} as const;

export type GenerateOptions = {
  systemInstruction: string;
  userPrompt: string;
  signal?: AbortSignal;
};

export type GenerateResult = {
  json: TrainerResponse;
  raw: string;
  modelVersion: string;
  promptTokens: number | null;
  completionTokens: number | null;
};

/** Низкоуровневый вызов — кидает ошибку при провале. Циклите через
 *  withCircuitBreaker из lib/safety/circuit-breaker.ts. */
export async function generateTrainerResponse(
  opts: GenerateOptions,
): Promise<GenerateResult> {
  const c = client();
  const res = await c.models.generateContent({
    model: TRAINER_MODEL,
    contents: opts.userPrompt,
    config: {
      systemInstruction: opts.systemInstruction,
      responseMimeType: "application/json",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      responseSchema: TRAINER_RESPONSE_SCHEMA as any,
      temperature: 0.4,
      abortSignal: opts.signal,
    },
  });

  const raw = res.text ?? "";
  if (!raw) {
    throw new Error("Gemini вернул пустой ответ");
  }

  let json: TrainerResponse;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `Gemini вернул невалидный JSON: ${(e as Error).message}. Fragment: ${raw.slice(0, 200)}`,
    );
  }

  const usage = res.usageMetadata;
  return {
    json,
    raw,
    modelVersion: TRAINER_MODEL,
    promptTokens: usage?.promptTokenCount ?? null,
    completionTokens: usage?.candidatesTokenCount ?? null,
  };
}

/** Альтернативное имя — `isAiConfigured` уже экспортируется из
 *  lib/ai/deepseek.ts (мультипровайдер). Здесь оставляем
 *  trainer-специфичную проверку: trainer работает только на Gemini. */
export function isStructuredTrainerConfigured(): boolean {
  return !!env.GEMINI_API_KEY && env.GEMINI_API_KEY.length > 10;
}
