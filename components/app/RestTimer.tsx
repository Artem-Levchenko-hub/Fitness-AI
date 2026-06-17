"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";

import { ExerciseDemo } from "@/components/app/ExerciseDemo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const RADIUS = 28;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Циркулярный таймер отдыха. Считает остаток против target.
 *  Overdue (превышение цели) — visible "+Xс", не блокирует UI. */
export function RestTimer({
  targetSeconds,
  startedAt,
  demoSlug,
}: {
  targetSeconds: number;
  startedAt: Date;
  /** Слаг текущего упражнения — тусклая демо-гифка фоном за таймером. */
  demoSlug?: string;
}) {
  const startedAtMs = startedAt.getTime();
  const [now, setNow] = useState(() => Date.now());
  const [paused, setPaused] = useState(false);
  const [accumulatedPauseMs, setAccumulatedPauseMs] = useState(0);
  const [pauseStartedMs, setPauseStartedMs] = useState<number | null>(null);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [paused]);

  function togglePause() {
    if (paused) {
      if (pauseStartedMs != null) {
        setAccumulatedPauseMs((acc) => acc + (Date.now() - pauseStartedMs));
        setPauseStartedMs(null);
      }
      setPaused(false);
    } else {
      setPauseStartedMs(Date.now());
      setPaused(true);
    }
  }

  const elapsed = Math.max(
    0,
    Math.floor((now - startedAtMs - accumulatedPauseMs) / 1000),
  );
  const remaining = Math.max(0, targetSeconds - elapsed);
  const overdue = elapsed > targetSeconds;

  const progress = Math.min(1, elapsed / targetSeconds);
  const dashoffset = CIRCUMFERENCE * (1 - progress);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className="bg-card border-border relative isolate flex items-center gap-3 overflow-hidden rounded-xl border p-3">
      {demoSlug ? (
        <ExerciseDemo slug={demoSlug} alt="" variant="background" className="-z-10" />
      ) : null}
      <div className="relative size-16 shrink-0">
        <svg
          viewBox="0 0 64 64"
          className="size-16 -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx="32"
            cy="32"
            r={RADIUS}
            fill="none"
            className="stroke-muted"
            strokeWidth="4"
          />
          <circle
            cx="32"
            cy="32"
            r={RADIUS}
            fill="none"
            className={cn(
              "transition-[stroke-dashoffset] duration-200",
              overdue ? "stroke-success" : "stroke-primary",
            )}
            strokeWidth="4"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={overdue ? 0 : dashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div
          className={cn(
            "tabular absolute inset-0 flex flex-col items-center justify-center text-xs font-semibold tracking-tight",
            overdue && "text-success",
          )}
          aria-live="polite"
        >
          <span className="text-base leading-none">
            {minutes}:{String(seconds).padStart(2, "0")}
          </span>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium tracking-wide uppercase">Отдых</p>
        <p className="text-muted-foreground text-xs">
          {overdue
            ? `Готов с +${elapsed - targetSeconds}c`
            : `Цель ${targetSeconds}с`}
        </p>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={togglePause}
        aria-label={paused ? "Продолжить таймер" : "Пауза"}
        className="size-9"
      >
        {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
      </Button>
    </div>
  );
}
