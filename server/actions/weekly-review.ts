"use server";

import { isAiConfigured } from "@/lib/ai/deepseek";
import { WEEKLY_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import {
  generateTrainerResponse,
  type TrainerResponse,
} from "@/lib/ai/trainer-structured";
import { formatWeeklyReviewBlock } from "@/lib/ai/weekly-review";
import { requireUser } from "@/lib/auth/require-user";
import { getUserProfile } from "@/lib/repos/body.repo";
import { weeklyReviewData } from "@/lib/repos/stats.repo";
import {
  CircuitOpenError,
  withCircuitBreaker,
} from "@/lib/safety/circuit-breaker";

export type WeeklyReviewResult =
  | { ok: true; data: TrainerResponse }
  | { ok: false; error: string };

const WEEKLY_TIMEOUT_MS = 45_000;

/** H8.1 — синхронный недельный разбор «по запросу» с /stats. Собирает агрегаты
 *  текущей и прошлой ISO-недели (объём/сессии/группы мышц + заметка недели),
 *  отдаёт DeepSeek через тот же structured-путь, что post_workout, обёрнутый в
 *  circuit breaker + 45s timeout (R-32/33). Fail-soft (R-10): любой провал →
 *  {ok:false} с человекочитаемым сообщением, поток /stats не падает. */
export async function requestWeeklyReview(): Promise<WeeklyReviewResult> {
  const user = await requireUser();

  if (!isAiConfigured()) {
    return { ok: false, error: "AI-тренер сейчас не настроен." };
  }

  try {
    const profile = await getUserProfile(user.id);
    const tz = profile?.timezone ?? "Europe/Moscow";
    const data = await weeklyReviewData(user.id, new Date(), tz);

    if (data.current.sessions === 0 && data.previous.sessions === 0) {
      return {
        ok: false,
        error:
          "За эту и прошлую неделю нет завершённых силовых тренировок — разбирать пока нечего.",
      };
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

    return { ok: true, data: result.json };
  } catch (err) {
    if (err instanceof CircuitOpenError) {
      return { ok: false, error: err.message };
    }
    const msg =
      err instanceof Error && err.name === "TimeoutError"
        ? "Разбор недели не успел за 45 секунд. Попробуйте ещё раз."
        : "Не удалось получить разбор недели. Попробуйте ещё раз.";
    return { ok: false, error: msg };
  }
}
