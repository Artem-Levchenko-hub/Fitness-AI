import { WEEKLY_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import {
  generateTrainerResponse,
  type GenerateResult,
} from "@/lib/ai/trainer-structured";
import {
  formatWeeklyReviewBlock,
  hasWeeklyData,
  type WeeklyReviewInput,
} from "@/lib/ai/weekly-review";
import { weeklyReviewData } from "@/lib/repos/stats.repo";
import { withCircuitBreaker } from "@/lib/safety/circuit-breaker";

/** Единый тайм-аут недельного LLM-вызова (R-32). */
export const WEEKLY_TIMEOUT_MS = 45_000;

/** Нет силовых сессий ни на этой, ни на прошлой неделе — разбирать нечего.
 *  Типизированная ошибка, чтобы вызыватели мапили её в дружелюбный fail-soft
 *  (кнопка «по запросу») или мягкий провал job-а (авто-воркер). */
export class NoWeeklyDataError extends Error {
  constructor() {
    super(
      "За эту и прошлую неделю нет завершённых силовых тренировок — разбирать пока нечего.",
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
 *  агрегаты этой и прошлой ISO-недели, форматирует промпт, зовёт DeepSeek
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

  const userPrompt = formatWeeklyReviewBlock(data);

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
