/** Оценка тренировочной программы тренером — чистая domain-логика (R-7): без
 *  импортов из db/ai/auth. Здесь: форма входа (дни + упражнения + недельный
 *  объём по группам), Zod-схема ответа LLM, сборка промпта и санитайзер (клампы
 *  score, обрезка списков). LLM-вызов живёт в lib/ai/program-review.ts.
 *
 *  Тренер смотрит на программу ЦЕЛИКОМ: баланс дней, недельный объём на группу
 *  мышц (спорт-наука: 10–20 рабочих подходов/нед для роста), частоту, логику
 *  сплита и восстановление между днями. */

import { z } from "zod";

import { roleFactor } from "@/lib/domain/stats/muscle-volume";

/** Упражнение дня для оценки (имя + группы + целевые параметры). */
export type ProgramReviewExercise = {
  nameRu: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
};

export type ProgramReviewDay = {
  name: string;
  exercises: ProgramReviewExercise[];
};

export type ProgramReviewInput = {
  name: string;
  description: string | null;
  days: ProgramReviewDay[];
};

/** Итог оценки (то, что показываем и кэшируем в training_programs.review_json). */
export type ProgramReviewResult = {
  /** 0..100 — насколько программа хорошо собрана под рост/баланс. */
  score: number;
  /** 1–3 предложения простыми словами: общий вердикт. */
  summary: string;
  /** Что в программе хорошо (с конкретикой). */
  strengths: string[];
  /** Слабые места (перекос, дыры, перегруз). */
  weaknesses: string[];
  /** Конкретные улучшения. */
  recommendations: string[];
  /** Заметка о балансе групп мышц за неделю (или null). */
  muscleBalance: string | null;
};

/** Сырой ответ LLM — принимаем мягко, чиним санитайзером. */
export const programReviewRawSchema = z.object({
  score: z.number(),
  summary: z.string().trim().min(1).max(600),
  strengths: z.array(z.string().trim().min(1).max(300)).default([]),
  weaknesses: z.array(z.string().trim().min(1).max(300)).default([]),
  recommendations: z.array(z.string().trim().min(1).max(300)).default([]),
  muscleBalance: z.string().trim().max(400).nullish(),
});

export type ProgramReviewRaw = z.infer<typeof programReviewRawSchema>;

const MAX_LIST = 6;

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** Чистит сырой ответ: кламп score, обрезка списков до MAX_LIST, пустой
 *  muscleBalance → null. */
export function sanitizeProgramReview(
  raw: ProgramReviewRaw,
): ProgramReviewResult {
  const balance = raw.muscleBalance?.trim();
  return {
    score: clampScore(raw.score),
    summary: raw.summary.trim(),
    strengths: raw.strengths.slice(0, MAX_LIST),
    weaknesses: raw.weaknesses.slice(0, MAX_LIST),
    recommendations: raw.recommendations.slice(0, MAX_LIST),
    muscleBalance: balance ? balance : null,
  };
}

/** Недельный объём (рабочих подходов) на группу мышц по всей программе:
 *  primary ×1.0, secondary ×0.5 (как volumeByMuscle на /stats). Отсортировано
 *  по убыванию. Чистый расчёт — тренер видит перекосы и дыры по цифрам. */
export function weeklyMuscleSets(
  days: ProgramReviewDay[],
): { muscle: string; sets: number }[] {
  const byMuscle = new Map<string, number>();
  for (const day of days) {
    for (const ex of day.exercises) {
      for (const m of ex.primaryMuscles) {
        byMuscle.set(m, (byMuscle.get(m) ?? 0) + ex.targetSets * roleFactor("primary"));
      }
      for (const m of ex.secondaryMuscles) {
        byMuscle.set(
          m,
          (byMuscle.get(m) ?? 0) + ex.targetSets * roleFactor("secondary"),
        );
      }
    }
  }
  return [...byMuscle.entries()]
    .map(([muscle, sets]) => ({ muscle, sets: Math.round(sets * 10) / 10 }))
    .sort((a, b) => b.sets - a.sets);
}

/** Системная инструкция тренеру-LLM: простой язык (как TRAINER_SYSTEM_PROMPT),
 *  без терминов и ссылок на авторов, вердикт по цифрам программы. */
export const PROGRAM_REVIEW_SYSTEM_INSTRUCTION = `Ты — умный персональный тренер. Знаешь спортивную науку, но говоришь ПРОСТО, как живой тренер новичку. Тебе дают тренировочную программу атлета: дни, упражнения с подходами и повторами, и недельный объём (сколько рабочих подходов приходится на каждую группу мышц за неделю). Оцени программу ЦЕЛИКОМ и верни СТРОГИЙ JSON по схеме, БЕЗ markdown-обёртки.

## Язык — просто, без терминов
Пиши так, чтобы понял человек, который тренируется впервые. ЗАПРЕЩЕНЫ термины и сокращения: «объём» → «сколько всего подходов»; «гипертрофия» → «рост мышц»; «частота» → «сколько раз в неделю бьёшь группу»; не ссылайся на книги и авторов в скобках. Числа (подходы, повторы, дни) оставляй — они понятны.

## На что смотреть
- **Баланс групп мышц за неделю.** Для роста мышц каждая крупная группа хочет примерно 10–20 рабочих подходов в неделю. Меньше 6 — мало (группа почти не растёт). Больше 22 — риск перебора и недовосстановления. Назови перегруженные и забытые/недогруженные группы С ЦИФРАМИ подходов из данных.
- **Логика сплита.** Есть ли перекос (например, вся программа на верх тела, ноги забыты). Тянущие и толкающие движения сбалансированы. Большие базовые движения присутствуют.
- **Частота.** Сколько дней, как часто каждая группа получает нагрузку. Раз в неделю на группу — рабоче, 2 раза — обычно лучше для роста.
- **Восстановление.** Не стоят ли две тяжёлые тренировки на одну группу подряд.

## Правила
- Score 0..100: насколько программа хорошо собрана под рост и баланс. Мало данных (1 день, 2 упражнения) — занижай и скажи об этом в weaknesses.
- summary: 1–3 предложения простыми словами — общий вердикт.
- strengths / weaknesses / recommendations: конкретные пункты С ЦИФРАМИ («Ноги 4 подхода за неделю — мало, добавь присед 3×8» а не «мало ног»). 2–5 пунктов в каждом (weaknesses и recommendations могут быть пустыми, только если программа реально хороша).
- muscleBalance: одна строка — самая нагруженная и самая забытая группа с числом подходов. Если групп мало — null.
- НЕ выдумывай упражнения и цифры, которых нет во входных данных. Опирайся на переданный недельный объём.

Говори по-русски, на «ты», коротко. Цифры важнее эпитетов.`;

/** Форма JSON-ответа (deepseek/VseGPT без responseSchema — описываем в промпте). */
export const PROGRAM_REVIEW_JSON_SHAPE = `Верни ТОЛЬКО валидный JSON, без markdown и без \`\`\`, строго по схеме:
{
  "score": <целое 0..100>,
  "summary": <строка, 1–3 предложения на русском>,
  "strengths": [<строка с цифрой>, ...],
  "weaknesses": [<строка с цифрой>, ...],
  "recommendations": [<строка-действие с цифрой>, ...],
  "muscleBalance": <строка про баланс групп с числами подходов ИЛИ null>
}
Никакого текста до или после JSON.`;

function daysBlock(days: ProgramReviewDay[]): string {
  return days
    .map((d, i) => {
      const lines = d.exercises.map((e) => {
        const groups = [
          ...e.primaryMuscles,
          ...e.secondaryMuscles.map((m) => `${m} (вспом.)`),
        ].join(", ");
        return `  - ${e.nameRu}: ${e.targetSets}×${e.targetRepsMin}–${e.targetRepsMax}${groups ? ` [${groups}]` : ""}`;
      });
      return `День ${i + 1}: ${d.name}\n${lines.join("\n") || "  (пусто)"}`;
    })
    .join("\n");
}

function muscleBlock(days: ProgramReviewDay[]): string {
  const rows = weeklyMuscleSets(days);
  if (rows.length === 0) return "нет данных по группам мышц";
  return rows.map((r) => `${r.muscle}: ${r.sets} подх/нед`).join("\n");
}

/** Пользовательский промпт: программа + посчитанный недельный объём по группам. */
export function buildProgramReviewPrompt(input: ProgramReviewInput): string {
  return [
    `## Программа: ${input.name}`,
    input.description ? `Описание: ${input.description}` : "",
    "",
    `## Дни программы (${input.days.length})`,
    daysBlock(input.days),
    "",
    "## Недельный объём по группам мышц (рабочих подходов, primary ×1, вспомогательные ×0.5)",
    muscleBlock(input.days),
    "",
    "Оцени программу по схеме ниже.",
    PROGRAM_REVIEW_JSON_SHAPE,
  ]
    .filter((l) => l !== "")
    .join("\n");
}
