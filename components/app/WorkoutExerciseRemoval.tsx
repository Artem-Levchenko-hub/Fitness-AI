"use client";

import { Loader2, Minus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useWorkoutPlanMutation, type WorkoutPlanMutationControl } from "@/components/app/useWorkoutPlanMutation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { clearSetDraft } from "@/lib/storage/set-input-draft";
import { removeWorkoutExerciseAction } from "@/server/actions/workouts";

export function WorkoutExerciseRemoval({ workoutId, workoutExerciseId, exerciseName, ...control }: WorkoutPlanMutationControl & {
  workoutId: string;
  workoutExerciseId: string;
  exerciseName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const mutation = useWorkoutPlanMutation({ workoutId, workoutExerciseId, ...control });

  async function remove() {
    const form = new FormData();
    form.set("workoutId", workoutId);
    form.set("workoutExerciseId", workoutExerciseId);
    if (await mutation.run(() => removeWorkoutExerciseAction(form))) {
      clearSetDraft(workoutExerciseId);
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <div className="space-y-1.5">
      <Button type="button" variant="ghost" size="sm" className="text-muted-foreground -ml-2 min-h-11 hover:text-destructive"
        aria-haspopup="dialog" disabled={!!mutation.reason || mutation.pending} onClick={() => { mutation.setError(""); setOpen(true); }}>
        <Minus className="size-4" aria-hidden />Убрать из плана
      </Button>
      {mutation.reason && !mutation.pending ? <p className="text-muted-foreground text-xs leading-relaxed">{mutation.reason}</p> : null}
      <Dialog open={open} onOpenChange={(value) => { if (!mutation.pending) setOpen(value); }}>
        <DialogContent className="sm:max-w-sm" showCloseButton={!mutation.pending}>
          <DialogHeader>
            <DialogTitle>Убрать упражнение из плана?</DialogTitle>
            <DialogDescription>«{exerciseName}» будет убрано из текущего плана. Записанные подходы сохранятся в тренировке и истории. Оставшиеся подходы выполнять не нужно.</DialogDescription>
          </DialogHeader>
          {mutation.error ? <p role="alert" className="text-destructive text-sm">{mutation.error}</p> : null}
          {mutation.reason && !mutation.pending ? <p className="text-muted-foreground text-xs leading-relaxed">{mutation.reason}</p> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" className="min-h-11" disabled={mutation.pending} onClick={() => setOpen(false)}>Отмена</Button>
            <Button type="button" variant="destructive" className="min-h-11" disabled={!!mutation.reason || mutation.pending} onClick={() => void remove()}>
              {mutation.pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {mutation.pending ? "Убираем…" : "Убрать из плана"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
