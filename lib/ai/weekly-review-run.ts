import { WEEKLY_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { extractPastAdvice } from "@/lib/ai/trainer-memory";
import {
  generateTrainerResponse,
  type GenerateResult,
} from "@/lib/ai/trainer-structured";
import {
  formatWeeklyMemoryBlock,
  formatWeeklyReviewBlock,
  hasWeeklyData,
  type WeeklyReviewInput,
} from "@/lib/ai/weekly-review";
import { isoWeekStartIso } from "@/lib/datetime/iso-week";
import { weeklyReviewData } from "@/lib/repos/stats.repo";
import { getPreviousWeeklyReview } from "@/lib/repos/workouts.repo";
import { withCircuitBreaker } from "@/lib/safety/circuit-breaker";

/** Локаль-стабильный формат даты для блока памяти (детерминизм без ICU-зависимости). */
function formatMemoryDate(d: Date): string {
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}

/** Единый тайм-аут недельного LLM-вызова (R-32). */
export const WEEKLY_TIMEOUT_MS = 45_000;

/** Нет завершённых тренировок НИ ОДНОГО формата (силовые, круговые, кардио) ни
 *  на этой, ни на прошлой неделе — разбирать нечего. Типизированная ошибка,
 *  чтобы вызыватели мапили её в дружелюбный fail-soft (кнопка «по запросу») или
 *  мягкий провал job-а (авто-воркер). */
export class NoWeeklyDataError extends Error {
  constructor() {
    super(
      "За эту и прошлую неделю нет завершённых тренировок (ни силовых, ни круговых, ни кардио) — разбирать пока нечего.",
    );
    this.name = "NoWeeklyDataError";
  }
}

export type WeeklyReviewGen = {
  data: WeeklyReviewInput;
  result: GenerateResult;
};

/** Ядро недельного разбора — ЕДИНСТВЕННЫЙ источник контракта «weekly-LLM»
 *  (тот же промпт, breaker `weekly-llm`, тайм-аут) для обоих путей: кнопки
 *  «по запросу» (H8.1) и авто-воркера по закрытии недели (H8.2). Собирает
 *  агрегаты этой и прошлой ISO-недели, форматирует промпт, зовёт основную модель
 *  через circuit breaker + timeout (R-32/33). Кидает NoWeeklyDataError, если
 *  обе недели пусты; пробрасывает CircuitOpenError/TimeoutError наверх. Не
 *  персистит — это делает вызыватель (worker пишет ai_analyses, кнопка нет). */
export async function generateWeeklyReview(
  userId: string,
  tz: string,
  now: Date,
): Promise<WeeklyReviewGen> {
  const data = await weeklyReviewData(userId, now, tz);
  if (!hasWeeklyData(data)) {
    throw new NoWeeklyDataError();
  }

  // H11.1b: память недельного тренера — прошлый weekly СТРОГО ДО начала текущей
  // ISO-недели (UTC-полночь понедельника безопасно лежит в зазоре между авто-job
  // прошлой недели и любым same-week force-job текущей недели).
  const weekStartInstant = new Date(`${isoWeekStartIso(now, tz)}T00:00:00Z`);
  const prevWeekly = await getPreviousWeeklyReview(userId, weekStartInstant);
  const memory = prevWeekly
    ? formatWeeklyMemoryBlock(extractPastAdvice(prevWeekly), formatMemoryDate)
    : "";

  const userPrompt = formatWeeklyReviewBlock(data, memory);

  const result = await withCircuitBreaker(
    "weekly-llm",
    () =>
      generateTrainerResponse({
        systemInstruction: WEEKLY_SYSTEM_PROMPT,
        userPrompt,
        signal: AbortSignal.timeout(WEEKLY_TIMEOUT_MS),
      }),
    { threshold: 3, cooldownMs: 60_000 },
  );

  return { data, result };
}
