import { cn } from "@/lib/utils/index";

import { InsightCards } from "./InsightCards";
import { TrainerStages } from "./TrainerStages";

/** H16.2 — ЕДИНЫЙ носитель состояния ожидания разбора (урок H4.3: один
 *  носитель паттерна, не два). Встраивается в loading-стейт обоих trainer-
 *  путей (`TrainerStreamConsumer` + `TrainerJobPoller`); H16.3 переиспользует
 *  его и на `/circuits/[id]`.
 *
 *  Компоновка (GoFundMe «Did you know?»): карточки книжных фактов — слой
 *  ПОВЕРХ живого скелета, НЕ замена ему. Нет workoutId / RAG молчит → карточки
 *  скрыты, скелет живёт сам (fail-soft композицией, R-10/R-37). */
export function TrainerWaiting({
  text,
  workoutId,
  circuitWorkoutId,
}: {
  text: string;
  /** Силовая — факты по её упражнениям. Без id факты не тянутся — остаётся
   *  чистый скелет (безопасно для любого вызова). */
  workoutId?: string;
  /** Круговая (H16.3) — факты по её упражнениям; передаётся вместо workoutId. */
  circuitWorkoutId?: string;
}) {
  const hasFacts = Boolean(workoutId || circuitWorkoutId);
  return (
    <div className="space-y-4">
      {hasFacts ? (
        <InsightCards workoutId={workoutId} circuitWorkoutId={circuitWorkoutId} />
      ) : null}
      <TrainerSkeleton text={text} />
    </div>
  );
}

/** Скелетон в форме будущей карточки разбора. Стрим не отдаёт Content-Length
 *  (streamText), поэтому честный индикатор — не прогресс-бар по процентам, а
 *  каркас того, что вот-вот появится: оценка, заметка, аспекты, сравнения,
 *  рекомендации. H16.3 — над каркасом «живые» стадии (Ahead-паттерн), которые
 *  видимо движутся; реальный статус-текст уходит в подпись под ними. */
export function TrainerSkeleton({ text }: { text: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="bg-card border-border space-y-6 rounded-2xl border p-6"
    >
      <div className="space-y-2">
        <TrainerStages />
        <p className="text-muted-foreground text-xs leading-relaxed">{text}</p>
      </div>

      <div
        aria-hidden="true"
        className="animate-pulse space-y-6 motion-reduce:animate-none"
      >
        {/* Оценка + иконка */}
        <div className="flex items-start justify-between gap-4">
          <Bar className="h-12 w-28" />
          <Bar className="size-10 rounded-full" />
        </div>

        {/* Мотивация (цитата) */}
        <div className="space-y-2 border-l-border border-l-2 pl-4">
          <Bar className="h-4 w-3/4" />
          <Bar className="h-4 w-1/2" />
        </div>

        {/* Аспекты */}
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1.5">
              <Bar className="h-4 w-40" />
              <Bar className="h-3 w-full" />
              <Bar className="h-3 w-5/6" />
            </div>
          ))}
        </div>

        {/* Сравнения по упражнениям */}
        <div className="space-y-1.5">
          <Bar className="h-9 w-full rounded-lg" />
          <Bar className="h-9 w-full rounded-lg" />
        </div>

        {/* Рекомендации */}
        <div className="space-y-2">
          <Bar className="h-4 w-48" />
          <Bar className="h-3 w-full" />
          <Bar className="h-3 w-11/12" />
          <Bar className="h-3 w-4/5" />
        </div>
      </div>
    </div>
  );
}

function Bar({ className }: { className?: string }) {
  return <div className={cn("bg-muted rounded", className)} />;
}
