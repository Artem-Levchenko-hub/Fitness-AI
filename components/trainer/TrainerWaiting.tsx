import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils/index";

import { InsightCards } from "./InsightCards";

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
}: {
  text: string;
  /** Без id факты не тянутся — остаётся чистый скелет (безопасно для любого
   *  вызова). */
  workoutId?: string;
}) {
  return (
    <div className="space-y-4">
      {workoutId ? <InsightCards workoutId={workoutId} /> : null}
      <TrainerSkeleton text={text} />
    </div>
  );
}

/** Скелетон в форме будущей карточки разбора. Стрим не отдаёт Content-Length
 *  (streamText), поэтому честный индикатор — не прогресс-бар по процентам, а
 *  каркас того, что вот-вот появится: оценка, заметка, аспекты, сравнения,
 *  рекомендации. Реальный статус-текст сверху меняется по факту прогресса. */
export function TrainerSkeleton({ text }: { text: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="bg-card border-border space-y-6 rounded-2xl border p-6"
    >
      <p className="text-muted-foreground flex items-center gap-2 text-sm leading-relaxed">
        <Loader2 className="text-primary size-4 shrink-0 animate-spin" />
        {text}
      </p>

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
