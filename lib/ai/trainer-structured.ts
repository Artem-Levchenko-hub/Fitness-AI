import { generateText } from "ai";

import { aiClient, COACH_MODEL, isAiConfigured } from "@/lib/ai/deepseek";
import {
  parseTrainerJson,
  type TrainerResponse,
} from "@/lib/ai/trainer-parse";

/** Парс/рендер живут в чистом env-free модуле (юнит-тестируемы) — реэкспорт
 *  ради обратной совместимости импортеров (stream route, cron worker). */
export {
  extractJson,
  parseTrainerJson,
  renderTrainerMarkdown,
  trainerSchema,
} from "@/lib/ai/trainer-parse";
export type {
  ExerciseComparison,
  TrainerResponse,
} from "@/lib/ai/trainer-parse";

/** Модель тренера = основная LLM (deepseek-v4-flash-thinking через VseGPT).
 *  Раньше тренер ходил в Gemini structured output (responseSchema); теперь
 *  единый openai-совместимый провайдер + JSON-инструкция + Zod-валидация. */
export const TRAINER_MODEL: string = COACH_MODEL;

/** Спецификация формы JSON — раньше её роль играл Gemini responseSchema.
 *  deepseek responseSchema не имеет, поэтому форму описываем в промпте. */
export const JSON_SHAPE_INSTRUCTION = `Верни ТОЛЬКО валидный JSON-объект, без markdown-обёртки и без \`\`\`, строго по схеме:
{
  "overallScore": <целое 0..100>,
  "trainingQuality": { "score": <целое 0..100>, "comment": <строка, 1-2 предложения на русском> },
  "recoveryContext": { "score": <целое 0..100 ИЛИ null если нет данных о сне>, "comment": <строка> },
  "nutritionContext": { "score": <целое 0..100 ИЛИ null если нет данных о КБЖУ>, "comment": <строка> },
  "exerciseComparisons": [ { "name": <упражнение>, "prevTopSet": <"60×5" ИЛИ null если раньше не было>, "curTopSet": <"60×6">, "deltaReps": <число ИЛИ null>, "deltaWeightKg": <число ИЛИ null>, "status": <"improved"|"regressed"|"stagnant"|"new"> } ] (3-6 ключевых упр. сегодняшней силовой; [] если не силовая),
  "recommendations": [<строка>, ...] (3-5 элементов),
  "nextSessionFocus": <строка — ОДНА конкретная корректировка на след. сессию с цифрой>,
  "missingDataAdvice": <строка ИЛИ null>,
  "motivation": <строка>,
  "whatWorked": <строка — что получилось в этой сессии, 1-2 конкретных позитива С ЦИФРАМИ>,
  "followUpQuestion": <строка — завершающий вопрос-приглашение к диалогу, ОБЯЗАТЕЛЬНО заканчивается на "?">,
  "pastAdviceFollowUp": <строка ИЛИ опусти, если в контексте нет блока «Память тренера» с прошлыми рекомендациями — оценка выполнения ПОСЛЕДНЕЙ прошлой рекомендации, начинается с «В прошлый раз я советовал …»>,
  "muscleBalanceNote": <строка ИЛИ опусти, если в контексте нет блока «Аватар: недельная нагрузка» — назови самую перегретую и самую недогруженную (0 подходов) группу мышц недели С ЦИФРАМИ подходов и дай ОДНУ рекомендацию выровнять нагрузку>,
  "balanceMuscleKeys": <массив КЛЮЧЕЙ групп мышц, упомянутых в muscleBalanceNote, ТОЛЬКО из списка: chest, back_lats, back_traps, shoulders_front, shoulders_side, shoulders_rear, biceps, triceps, forearms, core, glutes, quads, hamstrings, calves. Опусти, если muscleBalanceNote опущено>
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

  const json = parseTrainerJson(raw);

  return {
    json,
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
