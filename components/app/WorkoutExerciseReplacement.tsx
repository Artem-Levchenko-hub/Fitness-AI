"use client";

import { ArrowLeftRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ExercisePicker, type PickerExercise } from "@/components/app/ExercisePicker";
import { Button } from "@/components/ui/button";
import { listPending } from "@/lib/storage/outbox";
import { clearSetDraft } from "@/lib/storage/set-input-draft";
import { replaceWorkoutExerciseAction } from "@/server/actions/workouts";

export function WorkoutExerciseReplacement({ workoutId, workoutExerciseId, exerciseId, exercises, disabledReason, savingSet, replacing, onReplacingChange, onMutationStart, onMutationEnd }: {
  workoutId: string;
  workoutExerciseId: string;
  exerciseId: string;
  exercises: readonly PickerExercise[];
  disabledReason?: string;
  savingSet: boolean;
  replacing: boolean;
  onReplacingChange: (value: boolean) => void;
  onMutationStart: () => boolean;
  onMutationEnd: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(true);
  const inFlight = useRef(false);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  const choices = exercises.filter((exercise) => exercise.id !== exerciseId);
  const reason = disabledReason || (!online ? "Для замены подключитесь к интернету" : "") || (choices.length === 0 ? "Нет доступных упражнений для замены" : "");

  async function replace() {
    if (!selected || replacing || savingSet || reason || inFlight.current) return;
    if (navigator.onLine === false || !onMutationStart()) return;
    inFlight.current = true;
    onReplacingChange(true);
    setError("");
    try {
      // Check storage again: another tab may have queued a set since the picker opened.
      const queued = await listPending();
      if (queued.some((mutation) => String(mutation.payload.workoutId) === workoutId &&
        (mutation.kind === "finishWorkout" || (mutation.kind === "recordSet" && mutation.payload.workoutExerciseId === workoutExerciseId)))) {
        setError("Дождитесь синхронизации записанных подходов перед заменой");
        return;
      }
      const form = new FormData();
      form.set("workoutId", workoutId);
      form.set("workoutExerciseId", workoutExerciseId);
      form.set("replacementExerciseId", selected);
      const result = await replaceWorkoutExerciseAction(form);
      if (result.status === "error") { setError(result.message); return; }
      clearSetDraft(workoutExerciseId);
      router.refresh();
      setOpen(false);
    } catch {
      setError("Не удалось заменить упражнение. Проверьте подключение и повторите");
    } finally {
      inFlight.current = false;
      onReplacingChange(false);
      onMutationEnd();
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="ghost" size="sm" disabled={!!reason || savingSet || replacing}
        onClick={() => setOpen((value) => !value)} aria-expanded={open} className="text-muted-foreground -ml-2">
        <ArrowLeftRight className="size-4" aria-hidden />Заменить упражнение
      </Button>
      {reason ? <p className="text-muted-foreground text-xs">{reason}</p> : null}
      {open ? (
        <div className="border-border bg-muted/30 space-y-3 rounded-xl border p-3">
          <p className="text-muted-foreground text-xs leading-relaxed">Выполненные подходы останутся у исходного упражнения. Оставшиеся перейдут к замене. Вес выберите заново.</p>
          <ExercisePicker exercises={choices} value={selected} onChange={setSelected} disabled={replacing || savingSet || !!reason} aria-label="Упражнение для замены" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" disabled={!selected || replacing || savingSet || !!reason} onClick={() => void replace()}>
              {replacing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}Подтвердить замену
            </Button>
            <Button type="button" variant="ghost" disabled={replacing} onClick={() => setOpen(false)}>Отмена</Button>
          </div>
        </div>
      ) : null}
      {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
