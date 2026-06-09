"use client";

import { Loader2, Plus } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { recordSetAction, type RecordSetState } from "@/server/actions/workouts";
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
  const [state, formAction, pending] = useActionState<RecordSetState, FormData>(
    recordSetAction,
    { status: "idle" },
  );

  useEffect(() => {
    if (state.status === "idle" && !pending) {
      // После успешного добавления ставим фокус обратно на вес
      weightRef.current?.focus();
    }
  }, [state, pending]);

  function adjustWeight(delta: number) {
    const current = Number(weight) || 0;
    const next = Math.max(0, current + delta);
    setWeight(String(Number.isInteger(next) ? next : next.toFixed(1)));
  }
  function adjustReps(delta: number) {
    const current = Number(reps) || 0;
    setReps(String(Math.max(1, current + delta)));
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
            <Input
              ref={weightRef}
              id={`weight-${workoutExerciseId}`}
              name="weightKg"
              type="number"
              inputMode="decimal"
              step={0.5}
              min={0}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              onFocus={(e) => e.target.select()}
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
            <Input
              id={`reps-${workoutExerciseId}`}
              name="reps"
              type="number"
              inputMode="numeric"
              step={1}
              min={1}
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              onFocus={(e) => e.target.select()}
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
        <Input
          id={`rpe-${workoutExerciseId}`}
          name="rpe"
          type="number"
          inputMode="decimal"
          step={0.5}
          min={1}
          max={10}
          value={rpe}
          onChange={(e) => setRpe(e.target.value)}
              onFocus={(e) => e.target.select()}
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
