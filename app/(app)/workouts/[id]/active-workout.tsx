"use client";

import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudOff,
  Frown,
  Meh,
  Smile,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { RestTimer } from "@/components/app/RestTimer";
import { SetInput } from "@/components/app/SetInput";
import { GoalTrackBar } from "@/components/progression/GoalTrackBar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  FEELING_TAGS,
  type FeelingTagKey,
} from "@/lib/domain/workouts/feeling";
import {
  groupPendingByExerciseId,
  hasPendingFinish,
  pendingSetsFromOutbox,
  type PendingSet,
} from "@/lib/domain/workouts/pending-sets";
import { enqueue, listPending } from "@/lib/storage/outbox";
import type { PreviousSessionSummary } from "@/lib/domain/exercise/previous-session";
import type { GoalProgressView } from "@/lib/domain/progression/goal-projection";
import type { ActiveWorkout } from "@/lib/repos/workouts.repo";
import {
  cancelWorkoutAction,
  deleteSetAction,
  finishWorkoutAction,
} from "@/server/actions/workouts";
import { cn } from "@/lib/utils";

type Props = {
  workout: ActiveWorkout;
  previousByExerciseId: Map<string, PreviousSessionSummary>;
  goalByExerciseId: Map<string, GoalProgressView>;
};

/** Стабильная пустая ссылка — не плодим новый [] на каждый рендер. */
const EMPTY_PENDING: PendingSet[] = [];

export function ActiveWorkoutView({
  workout,
  previousByExerciseId,
  goalByExerciseId,
}: Props) {
  // H15.3b-2 — оптимистичный слой офлайн-подходов. Активная тренировка
  // рендерится сервером, но офлайн-записи лежат в IndexedDB-outbox; на маунте
  // восстанавливаем их (переживают reload), а офлайн-сабвмит добавляет через
  // onOfflineRecord. Дренаж/синк при реконнекте — H15.4.
  const [pending, setPending] = useState<PendingSet[]>([]);
  // H15.3c — офлайн-завершение тренировки. При офлайн-финише мутация кладётся в
  // outbox + UI показывает сессию завершённой оптимистично; на маунте флаг
  // восстанавливается из outbox (переживает reload). Реальный server-finish и
  // переход на разбор — дренаж H15.4.
  const [finishedOffline, setFinishedOffline] = useState(false);
  useEffect(() => {
    let alive = true;
    listPending().then((mutations) => {
      if (!alive) return;
      setPending(pendingSetsFromOutbox(mutations, workout.id));
      setFinishedOffline(hasPendingFinish(mutations, workout.id));
    });
    return () => {
      alive = false;
    };
  }, [workout.id]);

  const pendingByExerciseId = useMemo(
    () => groupPendingByExerciseId(pending),
    [pending],
  );

  const handleOfflineRecord = useCallback((set: PendingSet) => {
    setPending((prev) => [
      ...prev.filter((s) => s.clientId !== set.clientId),
      set,
    ]);
  }, []);

  const completedExercises = useMemo(
    () =>
      workout.exercises.filter(
        (e) =>
          e.sets.length + (pendingByExerciseId.get(e.id)?.length ?? 0) >=
          e.targetSets,
      ).length,
    [workout.exercises, pendingByExerciseId],
  );

  /** H12.4 — «Прервать» прямо из активной сессии (зеркало круговой/кардио:
   *  active-circuit.tsx / active-cardio.tsx). Раньше отменить зависшую силовую
   *  можно было только из resume-баннера на /dashboard·/workouts; H12.4 уводит
   *  «Убрать» в саму сессию, чтобы глобальная полоса возобновления осталась
   *  чисто-навигационной. cancelWorkoutAction ставит status=cancelled и уводит
   *  на /workouts. */
  async function handleCancel() {
    if (
      !confirm("Прервать тренировку? Прогресс сохранится, статус — cancelled.")
    ) {
      return;
    }
    const fd = new FormData();
    fd.append("workoutId", workout.id);
    await cancelWorkoutAction(fd);
  }

  // H15.3c — офлайн-завершение через outbox. Детерминированный ключ
  // `finish:<workoutId>` → двойной тап офлайн перезаписывает одну запись
  // (keyPath=clientId), а не плодит два реплея финиша. Payload зеркалит
  // FormData finishWorkoutAction — H15.4 реплеит ЧЕРЕЗ тот же server-action.
  async function finishOffline(fd: FormData) {
    await enqueue({
      clientId: `finish:${workout.id}`,
      kind: "finishWorkout",
      payload: {
        workoutId: workout.id,
        feeling: String(fd.get("feeling") ?? ""),
        feelingTag: String(fd.get("feelingTag") ?? ""),
      },
      queuedAt: Date.now(),
    });
    setFinishedOffline(true);
  }

  function handleFinish(e: React.FormEvent<HTMLFormElement>) {
    // Офлайн → preventDefault отменяет server-action, финиш уходит в outbox.
    // Онлайн → preventDefault НЕ зовём → нативный finishWorkoutAction
    // отрабатывает без изменений (столп 4 — онлайн-путь не тронут).
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      e.preventDefault();
      void finishOffline(new FormData(e.currentTarget));
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-card border-border rounded-2xl border p-4">
        <h2 className="text-base font-semibold tracking-tight">
          {workout.name}
        </h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Выполнено упражнений: <span className="tabular">{completedExercises}/{workout.exercises.length}</span>
        </p>
      </div>

      <ul className="space-y-3">
        {workout.exercises.map((ex, idx) => (
          <ExerciseCard
            key={ex.id}
            workoutId={workout.id}
            exercise={ex}
            index={idx}
            previous={previousByExerciseId.get(ex.exerciseId) ?? null}
            goal={goalByExerciseId.get(ex.exerciseId) ?? null}
            pending={pendingByExerciseId.get(ex.id) ?? EMPTY_PENDING}
            onOfflineRecord={handleOfflineRecord}
          />
        ))}
      </ul>

      {finishedOffline ? (
        // H15.3c — офлайн-финиш: сессия завершена локально, синхронизируется при
        // подключении (дренаж H15.4). Отличимо НЕ только цветом (R-41): иконки +
        // текст. На сервере тренировка остаётся active до дренажа (столп 4).
        <div
          role="status"
          className="border-success/30 bg-success/5 space-y-1 rounded-2xl border p-4 text-center"
        >
          <p className="text-success inline-flex items-center justify-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="size-5" aria-hidden />
            Тренировка завершена офлайн
          </p>
          <p className="text-muted-foreground inline-flex items-center justify-center gap-1.5 text-xs">
            <CloudOff className="size-3.5" aria-hidden />
            Синхронизируется при подключении
          </p>
        </div>
      ) : (
        <>
          <form
            action={finishWorkoutAction}
            onSubmit={handleFinish}
            className="space-y-3 pt-2"
          >
            <input type="hidden" name="workoutId" value={workout.id} />
            <FeelingPicker />
            <div className="space-y-1.5">
              <label
                htmlFor="feeling"
                className="text-muted-foreground block text-xs font-medium"
              >
                Добавить детали{" "}
                <span className="opacity-70">(необязательно)</span>
              </label>
              <Textarea
                id="feeling"
                name="feeling"
                rows={3}
                maxLength={1000}
                placeholder="Самочувствие, энергия, что болело, как спал — тренер учтёт это в разборе"
                className="resize-none"
              />
            </div>
            <Button type="submit" size="xl" variant="default" className="w-full">
              <CheckCircle2 className="size-5" />
              Завершить тренировку
            </Button>
          </form>

          <div className="flex justify-center pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={handleCancel}
            >
              <X className="size-4" />
              Прервать
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** H11.3 — самочувствие одним тапом (паттерн pliability). Тап по «легко/норм/
 *  тяжело» пишет workout_note, которую тренер читает при разборе следующей
 *  сессии. Иконка + подпись (не только цвет — R-41), тап ≥56px, повторный тап
 *  снимает выбор. Скип — заметка не пишется. */
const FEELING_STYLE: Record<
  FeelingTagKey,
  { Icon: typeof Smile; selected: string }
> = {
  easy: { Icon: Smile, selected: "border-success bg-success/10 text-success" },
  normal: { Icon: Meh, selected: "border-foreground/40 bg-muted text-foreground" },
  hard: { Icon: Frown, selected: "border-warning bg-warning/10 text-warning" },
};

function FeelingPicker() {
  const [selected, setSelected] = useState<FeelingTagKey | "">("");

  return (
    <div className="space-y-1.5">
      <p className="text-muted-foreground text-xs font-medium">
        Как далась тренировка?{" "}
        <span className="opacity-70">(необязательно)</span>
      </p>
      <input type="hidden" name="feelingTag" value={selected} />
      <div className="grid grid-cols-3 gap-2">
        {FEELING_TAGS.map((tag) => {
          const { Icon, selected: selectedClasses } = FEELING_STYLE[tag.key];
          const isSelected = selected === tag.key;
          return (
            <button
              key={tag.key}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelected(isSelected ? "" : tag.key)}
              className={cn(
                "border-border flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-medium capitalize transition-colors motion-safe:duration-150",
                isSelected
                  ? selectedClasses
                  : "text-muted-foreground hover:bg-muted/60",
              )}
            >
              <Icon className="size-5" />
              {tag.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ExerciseCard({
  workoutId,
  exercise,
  index,
  previous,
  goal,
  pending,
  onOfflineRecord,
}: {
  workoutId: string;
  exercise: ActiveWorkout["exercises"][number];
  index: number;
  previous: PreviousSessionSummary | null;
  goal: GoalProgressView | null;
  pending: PendingSet[];
  onOfflineRecord: (set: PendingSet) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  // Офлайн-подходы (pending) считаются наравне с серверными: прогресс,
  // завершённость и следующий индекс монотонны (line H15.3b-2 sharpen — иначе
  // N офлайн-подходов слились бы на одном setIndex).
  const totalDone = exercise.sets.length + pending.length;
  const completed = totalDone >= exercise.targetSets;
  const lastSet = exercise.sets[exercise.sets.length - 1];

  return (
    <li
      className={cn(
        "bg-card border-border rounded-2xl border",
        completed && "ring-success/20 bg-success/5 ring-2",
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 p-4 text-left"
        aria-expanded={expanded}
      >
        <span
          className={cn(
            "tabular bg-muted flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium",
            completed && "bg-success/20 text-success",
          )}
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">
            {exercise.exerciseNameRu}
          </h3>
          <p className="text-muted-foreground tabular mt-0.5 text-xs">
            <span>
              {totalDone}/{exercise.targetSets} ·{" "}
              {exercise.targetRepsMin}–{exercise.targetRepsMax} повт.
            </span>
            {exercise.targetWeightKg ? (
              <span> · цель {exercise.targetWeightKg} кг</span>
            ) : null}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="text-muted-foreground size-4 shrink-0" />
        ) : (
          <ChevronDown className="text-muted-foreground size-4 shrink-0" />
        )}
      </button>

      {expanded ? (
        <div className="space-y-4 border-t px-4 pt-4 pb-4">
          {exercise.sets.length > 0 || pending.length > 0 ? (
            <ul className="space-y-1.5">
              {exercise.sets.map((s) => (
                <li
                  key={s.id}
                  className="bg-background border-border flex items-center gap-3 rounded-lg border px-3 py-2"
                >
                  <span className="text-muted-foreground tabular w-6 text-center text-xs">
                    {s.setIndex + 1}
                  </span>
                  <span className="tabular flex-1 text-sm font-medium">
                    {s.weightKg} кг × {s.reps}
                    {s.rpe != null ? (
                      <span className="text-muted-foreground ml-2 text-xs font-normal">
                        RPE {s.rpe}
                      </span>
                    ) : null}
                  </span>
                  <form action={deleteSetAction}>
                    <input type="hidden" name="workoutId" value={workoutId} />
                    <input type="hidden" name="setId" value={s.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      aria-label="Удалить подход"
                      className="text-muted-foreground hover:text-destructive size-8"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </form>
                </li>
              ))}
              {/* H15.3b-2 — офлайн-подходы, ещё не синхронизированные. Отличимы
                  НЕ только цветом (R-41): иконка-облако + текстовая метка
                  «не синхр.». Удаления нет (нет серверного id; дренаж — H15.4). */}
              {pending.map((s) => (
                <li
                  key={s.clientId}
                  className="border-border/60 bg-muted/40 flex items-center gap-3 rounded-lg border border-dashed px-3 py-2"
                >
                  <span className="text-muted-foreground tabular w-6 text-center text-xs">
                    {s.setIndex + 1}
                  </span>
                  <span className="tabular flex-1 text-sm font-medium">
                    {s.weightKg} кг × {s.reps}
                    {s.rpe != null ? (
                      <span className="text-muted-foreground ml-2 text-xs font-normal">
                        RPE {s.rpe}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className="text-muted-foreground inline-flex items-center gap-1 text-[10px] font-medium"
                    title="Не синхронизировано — отправится при подключении"
                  >
                    <CloudOff className="size-3.5" aria-hidden />
                    не синхр.
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {!completed ? (
            <>
              {/* H12.1 — «Прошлый раз» в точке решения: подходы последней
                  завершённой сессии этого упражнения. Нет истории → строки
                  нет (R-37). */}
              {previous ? (
                <p className="text-muted-foreground tabular text-xs">
                  <span className="font-medium">Прошлый раз:</span>{" "}
                  {previous.sets
                    .map((s) => `${s.weightKg}×${s.reps}`)
                    .join(" · ")}
                </p>
              ) : null}

              {/* H18.2 (под-слайс B) — при активной цели упражнения тот же
                  GoalTrackBar, что на /exercises/[id]: «текущее→цель» прямо
                  в точке решения. Нет цели → ничего (R-37). */}
              {goal ? <GoalTrackBar view={goal} /> : null}

              {lastSet ? (
                <RestTimer
                  targetSeconds={exercise.targetRestSeconds}
                  startedAt={lastSet.completedAt}
                />
              ) : null}

              <SetInput
                workoutId={workoutId}
                workoutExerciseId={exercise.id}
                nextSetIndex={totalDone}
                defaultWeightKg={
                  lastSet?.weightKg ??
                  previous?.prefillWeightKg ??
                  exercise.targetWeightKg ??
                  null
                }
                defaultRepsMax={exercise.targetRepsMax}
                restSeconds={exercise.targetRestSeconds}
                onOfflineRecord={onOfflineRecord}
              />
            </>
          ) : (
            <p className="bg-success/10 text-success rounded-lg p-3 text-center text-xs font-medium">
              Все целевые подходы выполнены
            </p>
          )}
        </div>
      ) : null}
    </li>
  );
}
