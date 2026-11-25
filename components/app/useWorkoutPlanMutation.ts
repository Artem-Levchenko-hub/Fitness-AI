"use client";

import { useEffect, useRef, useState } from "react";

import { listPending } from "@/lib/storage/outbox";

export type WorkoutPlanMutationControl = {
  disabledReason?: string;
  onMutationStart: () => boolean;
  onMutationEnd: () => void;
};

export function useWorkoutPlanMutation({
  workoutId,
  workoutExerciseId,
  disabledReason,
  onMutationStart,
  onMutationEnd,
}: WorkoutPlanMutationControl & {
  workoutId: string;
  workoutExerciseId?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(true);
  const inFlight = useRef(false);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const reason = disabledReason || (!online ? "Для изменения плана подключитесь к интернету" : "");

  async function run(mutate: () => Promise<{ status: "success" } | { status: "error"; message: string }>) {
    if (inFlight.current || reason) return false;
    if (!navigator.onLine) {
      setError("Для изменения плана подключитесь к интернету");
      return false;
    }
    if (!onMutationStart()) return false;
    inFlight.current = true;
    setPending(true);
    setError("");
    try {
      // Another tab can enqueue a set or finish while the picker is open.
      const queued = await listPending();
      const forWorkout = queued.filter((mutation) => String(mutation.payload.workoutId) === workoutId);
      if (forWorkout.some((mutation) => mutation.kind === "finishWorkout")) {
        setError("Тренировка ожидает синхронизации завершения");
        return false;
      }
      if (workoutExerciseId && forWorkout.some((mutation) => mutation.kind === "recordSet" && mutation.payload.workoutExerciseId === workoutExerciseId)) {
        setError("Дождитесь синхронизации записанных подходов перед изменением плана");
        return false;
      }
      if (!navigator.onLine) {
        setError("Для изменения плана подключитесь к интернету");
        return false;
      }
      const result = await mutate();
      if (result.status === "error") {
        setError(result.message);
        return false;
      }
      return true;
    } catch {
      setError("Не удалось изменить план. Проверьте подключение и повторите");
      return false;
    } finally {
      inFlight.current = false;
      setPending(false);
      onMutationEnd();
    }
  }

  return { pending, error, setError, reason, run };
}
