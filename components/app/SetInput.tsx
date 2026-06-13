"use client";

import { Loader2, Plus } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/ui/number-field";
import { recordSetAction, type RecordSetState } from "@/server/actions/workouts";
import {
  clearSetDraft,
  loadSetDraft,
  saveSetDraft,
} from "@/lib/storage/set-input-draft";
import { cn } from "@/lib/utils";

type Props = {
  workoutId: string;
  workoutExerciseId: string;
  nextSetIndex: number;
  defaultWeightKg: number | null;
  defaultRepsMax: number;
  restSeconds: number;
};

export function SetInput({
  workoutId,
  workoutExerciseId,
  nextSetIndex,
  defaultWeightKg,
  defaultRepsMax,
  restSeconds,
}: Props) {
  const [weight, setWeight] = useState<string>(
    defaultWeightKg ? String(defaultWeightKg) : "",
  );
  const [reps, setReps] = useState<string>(String(defaultRepsMax));
  const [rpe, setRpe] = useState<string>("");

  const weightRef = useRef<HTMLInputElement>(null);
  const wasPendingRef = useRef(false);
  const [state, formAction, pending] = useActionState<RecordSetState, FormData>(
    recordSetAction,
    { status: "idle" },
  );

  // H10.4: восстановить НЕсабмитнутый черновик на маунте. Эффект, а не
  // useState-инициализатор — на сервере localStorage нет, первый клиентский
  // рендер обязан совпасть с серверным (defaults), иначе hydration mismatch.
  useEffect(() => {
    const draft = loadSetDraft(workoutExerciseId);
    if (!draft) return;
    // Синхронизация из внешнего хранилища (localStorage) на маунте — это ровно
    // тот случай, для которого setState-в-эффекте уместен (нельзя в
    // инициализаторе useState без hydration mismatch: сервер не видит draft).
    /* eslint-disable react-hooks/set-state-in-effect */
    setWeight(draft.weight);
    setReps(draft.reps);
    setRpe(draft.rpe);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [workoutExerciseId]);

  useEffect(() => {
    if (state.status === "idle" && !pending) {
      // После успешного добавления ставим фокус обратно на вес
      weightRef.current?.focus();
      // H10.4: подход записан на сервер → черновик больше не нужен. Успех
      // detect-им по переходу pending true→false без ошибки (success-ветка
      // recordSetAction возвращает тот же {status:"idle"}, что и стартовый —
      // отличить можно только по факту бывшего in-flight сабмита).
      if (wasPendingRef.current) {
        clearSetDraft(workoutExerciseId);
      }
    }
    wasPendingRef.current = pending;
  }, [state, pending, workoutExerciseId]);

  // H10.4: сохраняем черновик ТОЛЬКО при реальном вводе пользователя (не на
  // маунте) — иначе нетронутые defaults (reps=defaultRepsMax) клобберят слой.
  function persistDraft(next: { weight?: string; reps?: string; rpe?: string }) {
    saveSetDraft(workoutExerciseId, {
      weight: next.weight ?? weight,
      reps: next.reps ?? reps,
      rpe: next.rpe ?? rpe,
    });
  }
  function changeWeight(value: string) {
    setWeight(value);
    persistDraft({ weight: value });
  }
  function changeReps(value: string) {
    setReps(value);
    persistDraft({ reps: value });
  }
  function changeRpe(value: string) {
    setRpe(value);
    persistDraft({ rpe: value });
  }

  function adjustWeight(delta: number) {
    const current = Number(weight) || 0;
    const next = Math.max(0, current + delta);
    changeWeight(String(Number.isInteger(next) ? next : next.toFixed(1)));
  }
  function adjustReps(delta: number) {
    const current = Number(reps) || 0;
    changeReps(String(Math.max(1, current + delta)));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input type="hidden" name="workoutId" value={workoutId} />
      <input type="hidden" name="workoutExerciseId" value={workoutExerciseId} />
      <input type="hidden" name="setIndex" value={nextSetIndex} />
      <input type="hidden" name="restSeconds" value={restSeconds} />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label
            htmlFor={`weight-${workoutExerciseId}`}
            className="text-muted-foreground mb-1 block text-[10px] font-medium tracking-wide uppercase"
          >
            Вес, кг
          </label>
          <div className="flex items-stretch gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => adjustWeight(-2.5)}
              aria-label="−2.5 кг"
              className="size-11 shrink-0"
            >
              −
            </Button>
            <NumberField
              ref={weightRef}
              id={`weight-${workoutExerciseId}`}
              name="weightKg"
              decimal
              value={weight}
              onChange={changeWeight}
              required
              className="tabular h-11 text-center text-xl font-semibold"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => adjustWeight(+2.5)}
              aria-label="+2.5 кг"
              className="size-11 shrink-0"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>

        <div>
          <label
            htmlFor={`reps-${workoutExerciseId}`}
            className="text-muted-foreground mb-1 block text-[10px] font-medium tracking-wide uppercase"
          >
            Повторений
          </label>
          <div className="flex items-stretch gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => adjustReps(-1)}
              aria-label="−1 повторение"
              className="size-11 shrink-0"
            >
              −
            </Button>
            <NumberField
              id={`reps-${workoutExerciseId}`}
              name="reps"
              value={reps}
              onChange={changeReps}
              required
              className="tabular h-11 text-center text-xl font-semibold"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => adjustReps(+1)}
              aria-label="+1 повторение"
              className="size-11 shrink-0"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <div>
        <label
          htmlFor={`rpe-${workoutExerciseId}`}
          className="text-muted-foreground mb-1 block text-[10px] font-medium tracking-wide uppercase"
        >
          RPE (опционально, 1–10)
        </label>
        <NumberField
          id={`rpe-${workoutExerciseId}`}
          name="rpe"
          decimal
          value={rpe}
          onChange={changeRpe}
          className="tabular h-9 text-center"
          placeholder="напр. 8"
        />
      </div>

      {state.status === "error" ? (
        <p className="text-destructive text-sm" role="alert">
          {state.message}
        </p>
      ) : null}

      <Button
        type="submit"
        size="xl"
        className={cn("w-full")}
        disabled={pending || !weight || !reps}
        aria-busy={pending}
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Сохраняем…
          </>
        ) : (
          `Завершить подход ${nextSetIndex + 1}`
        )}
      </Button>
    </form>
  );
}
