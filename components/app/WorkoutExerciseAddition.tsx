"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { ExercisePicker, type PickerExercise } from "@/components/app/ExercisePicker";
import { useWorkoutPlanMutation, type WorkoutPlanMutationControl } from "@/components/app/useWorkoutPlanMutation";
import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/ui/number-field";
import { addWorkoutExerciseAction } from "@/server/actions/workouts";

export function WorkoutExerciseAddition({ workoutId, exercises, ...control }: WorkoutPlanMutationControl & {
  workoutId: string;
  exercises: readonly PickerExercise[];
}) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [targetSets, setTargetSets] = useState("3");
  const mutation = useWorkoutPlanMutation({ workoutId, ...control });
  const reason = mutation.reason || (exercises.length === 0 ? "Все доступные упражнения уже есть в плане" : "");

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || reason || mutation.pending) return;
    const sets = Number(targetSets);
    if (!Number.isInteger(sets) || sets < 1 || sets > 20) {
      mutation.setError("Укажите количество подходов от 1 до 20");
      return;
    }
    const form = new FormData();
    form.set("workoutId", workoutId);
    form.set("exerciseId", selected);
    form.set("targetSets", String(sets));
    if (await mutation.run(() => addWorkoutExerciseAction(form))) {
      setOpen(false);
      setSelected(null);
      setTargetSets("3");
      router.refresh();
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" className="min-h-11 w-full" disabled={!!reason || mutation.pending}
        aria-expanded={open} aria-controls={`${id}-panel`} onClick={() => { mutation.setError(""); setOpen((value) => !value); }}>
        <Plus className="size-4" aria-hidden />Добавить упражнение
      </Button>
      {reason && !mutation.pending ? <p className="text-muted-foreground text-xs leading-relaxed">{reason}</p> : null}
      {open ? (
        <form id={`${id}-panel`} onSubmit={(event) => void add(event)} className="bg-card border-border space-y-3 rounded-2xl border p-3 sm:p-4">
          <ExercisePicker exercises={exercises} value={selected} onChange={setSelected} disabled={!!reason || mutation.pending} aria-label="Упражнение для добавления" />
          <div className="flex items-end gap-3">
            <div className="w-24 shrink-0 space-y-1.5">
              <label htmlFor={`${id}-sets`} className="text-muted-foreground block text-xs font-medium">Подходы</label>
              <NumberField id={`${id}-sets`} name="targetSets" value={targetSets} onChange={setTargetSets} maxLength={2}
                disabled={!!reason || mutation.pending} aria-describedby={`${id}-sets-help`} className="tabular min-h-11 text-center" />
            </div>
            <p id={`${id}-sets-help`} className="text-muted-foreground pb-2 text-xs leading-relaxed">От 1 до 20 подходов. Вес и повторы укажите при записи.</p>
          </div>
          {mutation.error ? <p role="alert" className="text-destructive text-sm">{mutation.error}</p> : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" className="min-h-11" disabled={!selected || !!reason || mutation.pending}>
              {mutation.pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
              {mutation.pending ? "Добавляем…" : "Добавить в тренировку"}
            </Button>
            <Button type="button" variant="ghost" className="min-h-11" disabled={mutation.pending} onClick={() => setOpen(false)}>Отмена</Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
