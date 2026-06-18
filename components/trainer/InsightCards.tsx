"use client";

import { useEffect, useRef, useState } from "react";

import { BodySilhouette } from "@/components/avatar/BodySilhouette";
import { summarizeSessionMuscles } from "@/lib/domain/avatar/session-muscles";

/** H16.2/H16.4 — мини-силуэт нагруженных мышц сессии в момент ожидания разбора
 *  (столп 2: «ждёшь разбор — видишь свои мышцы»). Книжные факты вынесены в
 *  отдельную статичную карусель `TrainerTips` (H16.4) — здесь остаётся только
 *  силуэт. Fail-soft по композиции (R-10/R-37): RAG молчит / нет групп / 500 →
 *  рендерим null, а карусель и скелет под нами живут сами. Источник —
 *  `/api/ai/trainer/insights` (RAG ≈1с), без LLM-генерации. */
export function InsightCards({
  workoutId,
  circuitWorkoutId,
}: {
  /** Силовая тренировка — мышцы её упражнений (H16.2). */
  workoutId?: string;
  /** Круговая — мышцы её упражнений (H16.3). Передаётся вместо workoutId. */
  circuitWorkoutId?: string;
}) {
  const [muscleGroups, setMuscleGroups] = useState<string[]>([]);
  const liveRef = useRef(true);

  // Какой id-параметр кормит /insights (силовая vs круговая). Один из двух.
  const queryParam = workoutId
    ? `workoutId=${encodeURIComponent(workoutId)}`
    : circuitWorkoutId
      ? `circuitWorkoutId=${encodeURIComponent(circuitWorkoutId)}`
      : null;

  // Тянем мышцы сессии один раз. AbortController — чистый cleanup.
  useEffect(() => {
    if (!queryParam) return;
    liveRef.current = true;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(`/api/ai/trainer/insights?${queryParam}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) return; // fail-soft: силуэт просто не появится
        const data = (await res.json()) as { muscleGroups?: string[] };
        if (!liveRef.current) return;
        if (Array.isArray(data.muscleGroups)) setMuscleGroups(data.muscleGroups);
      } catch {
        // Сеть/abort — силуэт не появится, разбор это не блокирует.
      }
    })();

    return () => {
      liveRef.current = false;
      controller.abort();
    };
  }, [queryParam]);

  const session = summarizeSessionMuscles(muscleGroups);
  if (session.keys.length === 0) return null;

  const activeSet = new Set<string>(session.keys);

  return (
    <section
      aria-label="Мышцы сегодняшней сессии"
      className="border-border bg-accent/40 flex items-center gap-3 rounded-2xl border p-5"
    >
      <BodySilhouette
        ariaLabel={`Мышцы сессии: ${session.label}`}
        className="h-16 w-20"
        shapeFill={(key) => ({
          className: activeSet.has(key)
            ? "fill-primary"
            : "fill-muted-foreground/20",
        })}
      />
      <p className="text-muted-foreground text-xs leading-relaxed">
        Сегодня нагружено:{" "}
        <span className="text-foreground font-medium">{session.label}</span>
      </p>
    </section>
  );
}
