import { generateText } from "ai";
import { z } from "zod";

import { aiClient, COACH_MODEL, isAiConfigured } from "@/lib/ai/deepseek";

/** Модель тренера = основная LLM (deepseek-v4-flash-thinking через VseGPT).
 *  Раньше тренер ходил в Gemini structured output (responseSchema); теперь
 *  единый openai-совместимый провайдер + JSON-инструкция + Zod-валидация. */
export const TRAINER_MODEL: string = COACH_MODEL;

export type ExerciseComparison = {
  name: string;
  /** Топ рабочий сет прошлый раз, "60×5"; null если упражнения раньше не было. */
  prevTopSet: string | null;
  /** Топ рабочий сет сегодня, "60×6". */
  curTopSet: string;
  deltaReps: number | null;
  deltaWeightKg: number | null;
  status: "improved" | "regressed" | "stagnant" | "new";
};

export type TrainerResponse = {
  overallScore: number;
  trainingQuality: { score: number; comment: string };
  recoveryContext: { score: number | null; comment: string };
  nutritionContext: { score: number | null; comment: string };
  exerciseComparisons: ExerciseComparison[];
  recommendations: string[];
  nextSessionFocus: string;
  missingDataAdvice: string | null;
  motivation: string;
};

const trainerSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  trainingQuality: z.object({
    score: z.number().int().min(0).max(100),
    comment: z.string(),
  }),
  recoveryContext: z.object({
    score: z.number().int().min(0).max(100).nullable(),
    comment: z.string(),
  }),
  nutritionContext: z.object({
    score: z.number().int().min(0).max(100).nullable(),
    comment: z.string(),
  }),
  exerciseComparisons: z
    .array(
      z.object({
        name: z.string(),
        prevTopSet: z.string().nullable(),
        curTopSet: z.string(),
        deltaReps: z.number().nullable(),
        deltaWeightKg: z.number().nullable(),
        status: z.enum(["improved", "regressed", "stagnant", "new"]),
      }),
    )
    .default([]),
  recommendations: z.array(z.string()),
  nextSessionFocus: z.string(),
  missingDataAdvice: z.string().nullable(),
  motivation: z.string(),
});

/** Спецификация формы JSON — раньше её роль играл Gemini responseSchema.
 *  deepseek responseSchema не имеет, поэтому форму описываем в промпте. */
const JSON_SHAPE_INSTRUCTION = `Верни ТОЛЬКО валидный JSON-объект, без markdown-обёртки и без \`\`\`, строго по схеме:
{
  "overallScore": <целое 0..100>,
  "trainingQuality": { "score": <целое 0..100>, "comment": <строка, 1-2 предложения на русском> },
  "recoveryContext": { "score": <целое 0..100 ИЛИ null если нет данных о сне>, "comment": <строка> },
  "nutritionContext": { "score": <целое 0..100 ИЛИ null если нет данных о КБЖУ>, "comment": <строка> },
  "exerciseComparisons": [ { "name": <упражнение>, "prevTopSet": <"60×5" ИЛИ null если раньше не было>, "curTopSet": <"60×6">, "deltaReps": <число ИЛИ null>, "deltaWeightKg": <число ИЛИ null>, "status": <"improved"|"regressed"|"stagnant"|"new"> } ] (3-6 ключевых упр. сегодняшней силовой; [] если не силовая),
  "recommendations": [<строка>, ...] (3-5 элементов),
  "nextSessionFocus": <строка>,
  "missingDataAdvice": <строка ИЛИ null>,
  "motivation": <строка>
}
Никакого текста до или после JSON.`;

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

/** Достаёт JSON-объект из ответа: срезает ```-ограждение и reasoning-текст
 *  thinking-модели до первой `{` и после последней `}`. */
function extractJson(text: string): string {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) s = fence[1].trim();
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first >= 0 && last > first) return s.slice(first, last + 1);
  return s;
}

/** Низкоуровневый вызов — кидает ошибку при провале. Циклите через
 *  withCircuitBreaker из lib/safety/circuit-breaker.ts. */
export async function generateTrainerResponse(
  opts: GenerateOptions,
): Promise<GenerateResult> {
  const result = await generateText({
    model: aiClient(COACH_MODEL),
    system: `${opts.systemInstruction}\n\n${JSON_SHAPE_INSTRUCTION}`,
    prompt: opts.userPrompt,
    temperature: 0.4,
    abortSignal: opts.signal,
  });

  const raw = result.text ?? "";
  if (!raw) {
    throw new Error("LLM вернул пустой ответ");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch (e) {
    throw new Error(
      `LLM вернул невалидный JSON: ${(e as Error).message}. Fragment: ${raw.slice(0, 200)}`,
    );
  }

  const validated = trainerSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `LLM JSON не прошёл валидацию схемы: ${validated.error.message}`,
    );
  }

  return {
    json: validated.data,
    raw,
    modelVersion: TRAINER_MODEL,
    promptTokens: result.usage?.inputTokens ?? null,
    completionTokens: result.usage?.outputTokens ?? null,
  };
}

/** Trainer-специфичная проверка: тренер теперь на том же openai-совместимом
 *  провайдере, что и коуч (deepseek через VseGPT). */
export function isStructuredTrainerConfigured(): boolean {
  return isAiConfigured();
}
