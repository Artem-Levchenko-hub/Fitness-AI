"use server";

import { isAiConfigured } from "@/lib/ai/deepseek";
import { buildExerciseLinkMap } from "@/lib/ai/exercise-links";
import { type TrainerResponse } from "@/lib/ai/trainer-structured";
import {
  generateWeeklyReview,
  NoWeeklyDataError,
} from "@/lib/ai/weekly-review-run";
import { requireUser } from "@/lib/auth/require-user";
import { getUserProfile } from "@/lib/repos/body.repo";
import { claimAiCapacity, settleAiCapacity } from "@/lib/ai/guard";
import { CircuitOpenError } from "@/lib/safety/circuit-breaker";

export type WeeklyReviewResult =
  | {
      ok: true;
      data: TrainerResponse;
      /** H11.1c/H13: карта «имя движения → exerciseId» (топ-движения недели)
       *  для кликабельных строк exerciseComparisons на /stats. */
      exerciseLinks: Record<string, string>;
    }
  | { ok: false; error: string };

/** H8.1 — синхронный недельный разбор «по запросу» с /stats. Делегирует сбор
 *  агрегатов + LLM-вызов общему ядру `generateWeeklyReview` (тот же контракт,
 *  что у авто-воркера H8.2 — circuit breaker + 45s timeout, R-32/33). Здесь —
 *  только UX-обвязка: проверка конфигурации и fail-soft (R-10): любой провал →
 *  {ok:false} с человекочитаемым сообщением, поток /stats не падает. */
export async function requestWeeklyReview(): Promise<WeeklyReviewResult> {
  const user = await requireUser();

  if (!isAiConfigured()) {
    return { ok: false, error: "AI-тренер сейчас не настроен." };
  }

  const capacity = await claimAiCapacity({
    userId: user.id,
    operation: "weekly_review",
    requestKey: `weekly-manual:${user.id}:${new Date().toISOString().slice(0, 10)}`,
  });
  if (capacity.kind !== "allowed") {
    return {
      ok: false,
      error:
        capacity.kind === "subscription_required"
          ? "Для недельного AI-разбора нужна активная подписка Pro."
          : capacity.kind === "quota_exceeded"
            ? capacity.message
            : "Слишком много AI-запросов. Попробуйте чуть позже.",
    };
  }

  try {
    const profile = await getUserProfile(user.id);
    const tz = profile?.timezone ?? "Europe/Moscow";
    const { data, result } = await generateWeeklyReview(user.id, tz, new Date());
    await settleAiCapacity(capacity.usageId, true);
    const exerciseLinks = buildExerciseLinkMap(
      data.keyMovements.map((m) => ({
        exerciseId: m.exerciseId,
        exerciseNameRu: m.nameRu,
        exerciseNameEn: m.nameEn,
      })),
    );
    return { ok: true, data: result.json, exerciseLinks };
  } catch (err) {
    await settleAiCapacity(capacity.usageId, false);
    if (err instanceof NoWeeklyDataError) {
      return { ok: false, error: err.message };
    }
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
