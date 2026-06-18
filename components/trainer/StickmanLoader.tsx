"use client";

import { useEffect, useState } from "react";

import { getExerciseDemo } from "@/lib/domain/exercises/demos";
import { cn } from "@/lib/utils/index";

/** H16.4 — лоадер ожидания разбора: реальная demo-GIF, где атлет ВЫПОЛНЯЕТ
 *  упражнение (приседает / жмёт / подтягивается) — вместо спиннера-кружка.
 *  Источник — self-hosted ExerciseDB-гифки из /public/exercises-demos (те же,
 *  что в демонстрациях упражнений). GIF анимируется нативно (не зависит от CSS/
 *  reduced-motion), поэтому «прям приседает» всегда.
 *
 *  Вариант выбирается случайно при монтировании. SSR-безопасно: первый пэйнт
 *  (сервер + первый клиент) — присед; рандом выставляется в эффекте через
 *  таймер-callback (не синхронный setState → react-hooks/set-state-in-effect). */

const EXERCISES = [
  { slug: "back-squat", verb: "приседает" },
  { slug: "bench-press-barbell", verb: "жмёт" },
  { slug: "pull-up", verb: "подтягивается" },
] as const;

export function StickmanLoader({ className }: { className?: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setIndex(Math.floor(Math.random() * EXERCISES.length));
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const exercise = EXERCISES[index]!;
  const demo = getExerciseDemo(exercise.slug);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center justify-center", className)}
    >
      {demo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={demo.gif}
          alt={`Атлет ${exercise.verb}, пока готовится разбор`}
          loading="eager"
          decoding="async"
          className="size-full rounded-2xl bg-white object-contain"
        />
      ) : null}
      <span className="sr-only">Тренер думает — атлет {exercise.verb}</span>
    </div>
  );
}
