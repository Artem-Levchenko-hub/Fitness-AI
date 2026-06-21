import { cn } from "@/lib/utils/index";

import { InsightCards } from "./InsightCards";
import { RandomDemoLoader } from "./RandomDemoLoader";
import { TrainerStages } from "./TrainerStages";
import { TrainerTips } from "./TrainerTips";

/** H16.2/H16.4 — ЕДИНЫЙ носитель состояния ожидания разбора (урок H4.3: один
 *  носитель паттерна). Встраивается в loading-стейт обоих trainer-путей
 *  (`TrainerStreamConsumer` + `TrainerJobPoller`) и на `/circuits/[id]`.
 *
 *  Компоновка (GoFundMe «Did you know?»): силуэт нагруженных мышц + карусель
 *  коротких советов/ликбезов — слой ПОВЕРХ живого скелета. Скелет ведёт
 *  рандомная demo-гифка упражнения (вектор-StickmanLoader как reduce-fallback) +
 *  подписанные стадии. `thinking` (live-стрим) — хвост
 *  «мыслей» модели вместо статичной подписи; без него остаётся статичный text. */
export function TrainerWaiting({
  text,
  workoutId,
  circuitWorkoutId,
  thinking,
}: {
  text: string;
  /** Силовая — мышцы её упражнений для силуэта. Без id силуэт скрыт. */
  workoutId?: string;
  /** Круговая (H16.3) — мышцы её упражнений; передаётся вместо workoutId. */
  circuitWorkoutId?: string;
  /** Live-стрим (силовая): хвост reasoning модели для тикера «тренер размышляет». */
  thinking?: string;
}) {
  const hasFacts = Boolean(workoutId || circuitWorkoutId);
  return (
    <div className="space-y-4">
      {hasFacts ? (
        <InsightCards workoutId={workoutId} circuitWorkoutId={circuitWorkoutId} />
      ) : null}
      <TrainerTips />
      <TrainerSkeleton text={text} thinking={thinking} />
    </div>
  );
}

/** Скелетон в форме будущей карточки разбора. Стрим не отдаёт Content-Length,
 *  поэтому честный индикатор — каркас того, что вот-вот появится, а сверху —
 *  «живой» лоадер (рандомная demo-гифка) вместо зависшего спиннера + стадии.
 *  Под ними — тикер «мыслей» модели (live) либо статичный статус-текст. */
export function TrainerSkeleton({
  text,
  thinking,
}: {
  text: string;
  thinking?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="bg-card border-border space-y-6 rounded-2xl border p-6"
    >
      <div className="flex flex-col items-center gap-4">
        <RandomDemoLoader className="size-36" />
        <div className="w-full space-y-2">
          <TrainerStages />
          <ThinkingLine thinking={thinking} fallback={text} />
        </div>
      </div>

      <div aria-hidden="true" className="trainer-shimmer space-y-6 rounded-xl">
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

/** Подпись под лоадером: live-хвост «мыслей» модели (с плавной кареткой) либо
 *  статичный статус-текст. Чисто презентационно (без хуков) — безопасно в любом
 *  дереве. Длинный reasoning показываем хвостом, чтобы видеть свежую мысль. */
function ThinkingLine({
  thinking,
  fallback,
}: {
  thinking?: string;
  fallback: string;
}) {
  const text = (thinking ?? "").replace(/\s+/g, " ").trim();
  if (!text) {
    return (
      <p className="text-muted-foreground text-xs leading-relaxed">{fallback}</p>
    );
  }
  const tail = text.length > 150 ? `…${text.slice(-150)}` : text;
  return (
    <p
      aria-live="polite"
      className="text-muted-foreground text-xs leading-relaxed"
    >
      <span className="text-foreground/70 font-medium">Тренер размышляет: </span>
      {tail}
      <span
        aria-hidden="true"
        className="bg-muted-foreground/70 trainer-caret ml-0.5 inline-block h-3 w-px align-middle"
      />
    </p>
  );
}

function Bar({ className }: { className?: string }) {
  return <div className={cn("bg-muted rounded", className)} />;
}
