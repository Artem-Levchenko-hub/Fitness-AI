"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";

import { WAITING_STAGES, stageStates } from "@/lib/trainer/waiting-stages";
import { cn } from "@/lib/utils/index";

/** H16.3 — «живой» лоадер ожидания разбора (де-фриз): подписанные стадии,
 *  которые ВИДИМО движутся по времени (Ahead-паттерн), вместо одного зависшего
 *  спиннера. Стадии косметически-таймерные (см. waiting-stages.ts) — не врут
 *  про реальный прогресс LLM, но дают ощущение, что что-то происходит.
 *
 *  motion-safe: при `prefers-reduced-motion` лента не тикает и спиннер не
 *  крутится — спокойный статичный список (первая стадия active), без дёрганья. */

const TICK_MS = 1000;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

export function TrainerStages() {
  // elapsed=0 на первом пэйнте (и на сервере, и на клиенте) → ноль hydration-
  // рассинхрона; matchMedia читаем только в эффекте (после монтирования).
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) return; // спокойный фолбэк: лента не двигается
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const states = stageStates(elapsedMs);

  return (
    <ul className="space-y-2" aria-hidden="true">
      {WAITING_STAGES.map((stage, i) => {
        const state = states[i]!;
        return (
          <li
            key={stage.id}
            className={cn(
              "flex items-center gap-2 text-sm transition-colors duration-500",
              state === "active"
                ? "text-foreground font-medium"
                : state === "done"
                  ? "text-muted-foreground"
                  : "text-muted-foreground/40",
            )}
          >
            <span className="flex size-4 shrink-0 items-center justify-center">
              {state === "done" ? (
                <Check className="text-success size-4" />
              ) : state === "active" ? (
                <span className="bg-primary size-2 animate-pulse rounded-full motion-reduce:animate-none" />
              ) : (
                <span className="bg-border size-1.5 rounded-full" />
              )}
            </span>
            {stage.label}
          </li>
        );
      })}
    </ul>
  );
}
