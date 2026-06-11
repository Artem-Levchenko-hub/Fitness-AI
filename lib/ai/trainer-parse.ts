import { z } from "zod";

import type { TrendStatus } from "@/lib/domain/progression/trend";

/** Чистый парс/рендер structured-разбора тренера — БЕЗ импортов ai/deepseek/env,
 *  чтобы логику можно было юнит-тестировать (vitest без SKIP_ENV). Сетевой вызов
 *  LLM живёт в lib/ai/trainer-structured.ts, который реэкспортит этот модуль. */

export type ExerciseComparison = {
  name: string;
  /** Топ рабочий сет прошлый раз, "60×5"; null если упражнения раньше не было. */
  prevTopSet: string | null;
  /** Топ рабочий сет сегодня, "60×6". */
  curTopSet: string;
  deltaReps: number | null;
  deltaWeightKg: number | null;
  status: TrendStatus;
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
  /** H5.4 «что хорошо» — 1-2 конкретных позитива сессии с цифрами. Optional:
   *  legacy-разборы (до H5.4) его не несут — safeParse не должен их валить. */
  whatWorked?: string;
  /** H5.4 завершающий вопрос-приглашение к диалогу. Optional по той же причине. */
  followUpQuestion?: string;
};

export const trainerSchema = z.object({
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
  // optional — legacy resultJson (до H5.4) их не несёт; знак «?» в
  // followUpQuestion проверяет не схема (fail-soft R-10), а assertCoachTemplate.
  whatWorked: z.string().optional(),
  followUpQuestion: z.string().optional(),
});

/** Достаёт JSON-объект из ответа: срезает ```-ограждение и reasoning-текст
 *  thinking-модели до первой `{` и после последней `}`. */
export function extractJson(text: string): string {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) s = fence[1].trim();
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first >= 0 && last > first) return s.slice(first, last + 1);
  return s;
}

/** Парсит сырой ответ LLM в валидированный TrainerResponse: extractJson →
 *  JSON.parse → Zod. Кидает с диагностикой при провале. Общий код для
 *  generateText-пути (cron) и streamText-пути (live-стрим в onFinish). */
export function parseTrainerJson(raw: string): TrainerResponse {
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
  return validated.data;
}

/** Рендерит структурный разбор в markdown для поля content в ai_analyses.
 *  Общий для cron-воркера и live-стрима. */
export function renderTrainerMarkdown(r: TrainerResponse): string {
  const lines: string[] = [
    `# Разбор тренировки (${r.overallScore}/100)`,
    "",
    `**${r.motivation}**`,
    "",
    `## Качество тренировки · ${r.trainingQuality.score}/100`,
    r.trainingQuality.comment,
  ];
  if (r.whatWorked?.trim()) {
    lines.push("", "## Что хорошо", r.whatWorked);
  }
  lines.push(
    "",
    `## Восстановление (сон) · ${r.recoveryContext.score ?? "—"}`,
    r.recoveryContext.comment,
    "",
    `## Питание (КБЖУ) · ${r.nutritionContext.score ?? "—"}`,
    r.nutritionContext.comment,
    "",
    `## Что сделать в следующей сессии`,
    `_Фокус: ${r.nextSessionFocus}_`,
    "",
    ...r.recommendations.map((rec) => `- ${rec}`),
  );
  if (r.missingDataAdvice) {
    lines.push("", "## Чтобы разбор был точнее", r.missingDataAdvice);
  }
  if (r.followUpQuestion?.trim()) {
    lines.push("", "## Вопрос от тренера", `_${r.followUpQuestion}_`);
  }
  return lines.join("\n");
}
