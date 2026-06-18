import { cn } from "@/lib/utils/index";

import { InsightCards } from "./InsightCards";
import { StickmanLoader } from "./StickmanLoader";
import { TrainerStages } from "./TrainerStages";
import { TrainerTips } from "./TrainerTips";

/** H16.2/H16.4 — ЕДИНЫЙ носитель состояния ожидания разбора (урок H4.3: один
 *  носитель паттерна). Встраивается в loading-стейт обоих trainer-путей
 *  (`TrainerStreamConsumer` + `TrainerJobPoller`) и на `/circuits/[id]`.
 *
 *  Компоновка (GoFundMe «Did you know?»): силуэт нагруженных мышц + карусель
 *  коротких советов/ликбезов — слой ПОВЕРХ живого скелета. Скелет ведёт
 *  стикман-лоадер (атлет жмёт/приседает/подтягивается). Силуэт зависит от RAG
 *  (нужен workoutId) и fail-soft скрывается; советы статичны и есть всегда. */
export function TrainerWaiting({
  text,
  workoutId,
  circuitWorkoutId,
}: {
  text: string;
  /** Силовая — мышцы её упражнений для силуэта. Без id силуэт скрыт. */
  workoutId?: string;
  /** Круговая (H16.3) — мышцы её упражнений; передаётся вместо workoutId. */
  circuitWorkoutId?: string;
}) {
  const hasFacts = Boolean(workoutId || circuitWorkoutId);
  return (
    <div className="space-y-4">
      {hasFacts ? (
        <InsightCards workoutId={workoutId} circuitWorkoutId={circuitWorkoutId} />
      ) : null}
      <TrainerTips />
      <TrainerSkeleton text={text} />
    </div>
  );
}

/** Скелетон в форме будущей карточки разбора. Стрим не отдаёт Content-Length,
 *  поэтому честный индикатор — каркас того, что вот-вот появится, а сверху —
 *  «живой» стикман-лоадер (вместо зависшего спиннера) + подписанные стадии. */
export function TrainerSkeleton({ text }: { text: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="bg-card border-border space-y-6 rounded-2xl border p-6"
    >
      <div className="flex flex-col items-center gap-4">
        <StickmanLoader className="size-24" />
        <div className="w-full space-y-2">
          <TrainerStages />
          <p className="text-muted-foreground text-xs leading-relaxed">{text}</p>
        </div>
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
