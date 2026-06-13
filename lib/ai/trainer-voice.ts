/**
 * H11.2 — «голос тренера» на /dashboard: одна строка-совет из ПОСЛЕДНЕГО
 * разбора тренера, выведенная на главную как dismissible-секция. Тренер,
 * который уже всё разобрал, говорит первым ещё до входа в тренировку (столп 1).
 *
 * Чистый (env-free, R-7): db/auth не импортит — принимает уже выбранные строки
 * ai_analyses. Загрузку делает репозиторий. БЕЗ нового AI-вызова: читаем focus
 * (`nextSessionFocus`) уже сохранённого разбора.
 *
 * Приоритет: свежий per-workout разбор (конкретный фидбэк последней сессии) →
 * ведёт на сам разбор (`/workouts/<id>/trainer` либо `/circuits/<id>`, reuse
 * resolvePastAdviceHref H13.5). Fallback — недельный разбор (`weekly_review`),
 * ведёт на /stats, где он и показан (H8.2c). Ни одного с focus → null
 * (анти-фантом R-37: строка не рендерится вовсе).
 */

import { extractPastAdvice } from "./trainer-memory";
import { resolvePastAdviceHref } from "./past-advice-link";

/** Строка ai_analyses, достаточная для резолва голоса тренера. */
export type TrainerVoiceCandidate = {
  id: string;
  resultJson: unknown;
  createdAt: Date;
  workoutId: string | null;
  circuitWorkoutId: string | null;
};

export type TrainerVoice = {
  /** nextSessionFocus последнего разбора — что тренер советует к след. сессии. */
  focus: string;
  /** id разбора — ключ dismiss (новый id всплывает снова, shouldShowFocusHint). */
  analysisId: string;
  /** Куда ведёт тап — сам разбор (per-workout) либо /stats (недельный). */
  href: string;
};

export function buildTrainerVoice(
  perWorkout: TrainerVoiceCandidate | null,
  weekly: { id: string; resultJson: unknown; createdAt: Date } | null,
): TrainerVoice | null {
  // Свежий per-workout разбор приоритетен. Если у него нет focus (legacy
  // markdown-only) — не возвращаем null, а падаем на недельный fallback.
  if (perWorkout) {
    const focus = extractPastAdvice(perWorkout).focus;
    const href = resolvePastAdviceHref({
      workoutId: perWorkout.workoutId,
      circuitWorkoutId: perWorkout.circuitWorkoutId,
    });
    if (focus && href) {
      return { focus, analysisId: perWorkout.id, href };
    }
  }

  if (weekly) {
    const focus = extractPastAdvice(weekly).focus;
    if (focus) {
      return { focus, analysisId: weekly.id, href: "/stats" };
    }
  }

  return null;
}
