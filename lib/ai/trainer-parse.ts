import { z } from "zod";

import { MUSCLE_KEYS, type MuscleKey } from "@/lib/domain/avatar/heat";
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
  /** H5.5 «память тренера»: оценка выполнения прошлой рекомендации
   *  («В прошлый раз я советовал …»). Optional — заполняется только когда в
   *  контексте есть прошлые разборы того же формата; legacy не несут. */
  pastAdviceFollowUp?: string;
  /** H5.6 «баланс по аватару»: называет самую перегретую и самую недогруженную
   *  группу мышц недели + ОДНУ рекомендацию выровнять. Optional — заполняется
   *  только когда в контексте есть блок «Аватар: недельная нагрузка»; legacy
   *  не несут (safeParse не должен их валить). */
  muscleBalanceNote?: string;
  /** H17.0-B «петля текст→тело»: ключи групп мышц, которые тренер назвал в
   *  muscleBalanceNote (перегретая/недогруженная). Несут СТРУКТУРНЫЙ якорь под
   *  кликабельный силуэт (muscleBalanceNote — свободная проза без ключей).
   *  Optional — заполняется вместе с muscleBalanceNote; legacy/прочие разборы
   *  не несут. Выдуманные/невалидные ключи отсеяны normalizeBalanceKeys. */
  balanceMuscleKeys?: MuscleKey[];
};

const MUSCLE_KEY_SET = new Set<string>(MUSCLE_KEYS);

/** Нормализует сырой массив ключей мышц от LLM в валидные MuscleKey[]:
 *  отбрасывает неизвестные/null/дубли (R-10 fail-soft — выдуманный ключ не
 *  валит весь разбор), пусто/null/absent → undefined (силуэт не рендерится,
 *  R-37). Вынесено для прямого юнит-теста. */
export function normalizeBalanceKeys(
  raw: (string | null)[] | null | undefined,
): MuscleKey[] | undefined {
  if (!raw) return undefined;
  const seen = new Set<string>();
  const out: MuscleKey[] = [];
  for (const v of raw) {
    if (typeof v === "string" && MUSCLE_KEY_SET.has(v) && !seen.has(v)) {
      seen.add(v);
      out.push(v as MuscleKey);
    }
  }
  return out.length ? out : undefined;
}

/** Optional-строка, переживающая `null` от LLM. DeepSeek нондетерминированно
 *  эмитит `"field": null` вместо опускания ключа; `.nullish()` принимает и
 *  null, и отсутствие, а transform нормализует null→undefined, чтобы выходной
 *  тип остался `string | undefined` (downstream-консьюмеры уже null-safe).
 *  Без этого один `null` реджектил ВЕСЬ разбор → падал AI-job (R-10 fail-soft). */
const llmOptionalString = z
  .string()
  .nullish()
  .transform((v) => v ?? undefined);

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
  whatWorked: llmOptionalString,
  followUpQuestion: llmOptionalString,
  pastAdviceFollowUp: llmOptionalString,
  muscleBalanceNote: llmOptionalString,
  // H17.0-B — массив ключей мышц баланса. `.nullish()` ловит null/absent
  // (ловушка DeepSeek), элемент `.nullable()` терпит null внутри массива,
  // transform фильтрует к валидным MuscleKey (выдуманные ключи не валят разбор).
  balanceMuscleKeys: z
    .array(z.string().nullable())
    .nullish()
    .transform(normalizeBalanceKeys),
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
  if (r.pastAdviceFollowUp?.trim()) {
    lines.push("", "## Прошлый совет", r.pastAdviceFollowUp);
  }
  if (r.muscleBalanceNote?.trim()) {
    lines.push("", "## Баланс по аватару", r.muscleBalanceNote);
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
