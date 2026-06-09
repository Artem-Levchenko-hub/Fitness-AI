"use client";

import { CheckCircle2, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { RestTimer } from "@/components/app/RestTimer";
import { SetInput } from "@/components/app/SetInput";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ActiveWorkout } from "@/lib/repos/workouts.repo";
import { deleteSetAction, finishWorkoutAction } from "@/server/actions/workouts";
import { cn } from "@/lib/utils";

type Props = { workout: ActiveWorkout };

export function ActiveWorkoutView({ workout }: Props) {
  const completedExercises = useMemo(
    () =>
      workout.exercises.filter((e) => e.sets.length >= e.targetSets).length,
    [workout.exercises],
  );

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
          />
        ))}
      </ul>

      <form action={finishWorkoutAction} className="space-y-3 pt-2">
        <input type="hidden" name="workoutId" value={workout.id} />
        <div className="space-y-1.5">
          <label
            htmlFor="feeling"
            className="text-muted-foreground block text-xs font-medium"
          >
            Как прошла тренировка?{" "}
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
    </div>
  );
}

function ExerciseCard({
  workoutId,
  exercise,
  index,
}: {
  workoutId: string;
  exercise: ActiveWorkout["exercises"][number];
  index: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const completed = exercise.sets.length >= exercise.targetSets;
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
              {exercise.sets.length}/{exercise.targetSets} ·{" "}
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
          {exercise.sets.length > 0 ? (
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
            </ul>
          ) : null}

          {!completed ? (
            <>
              {lastSet ? (
                <RestTimer
                  targetSeconds={exercise.targetRestSeconds}
                  startedAt={lastSet.completedAt}
                />
              ) : null}

              <SetInput
                workoutId={workoutId}
                workoutExerciseId={exercise.id}
                nextSetIndex={exercise.sets.length}
                defaultWeightKg={
                  lastSet?.weightKg ?? exercise.targetWeightKg ?? null
                }
                defaultRepsMax={exercise.targetRepsMax}
                restSeconds={exercise.targetRestSeconds}
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
