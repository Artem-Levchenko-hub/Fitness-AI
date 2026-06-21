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

  // H-WOW — стадии как вертикальный таймлайн: соединительная линия слева
  // ЗАЛИВАЕТСЯ sage по мере прохождения стадий (пройденный сегмент = primary),
  // активная точка пульсирует мягким sage-ореолом. motion-safe: при reduce лента
  // не тикает (первая active) и ping-ореол скрыт.
  return (
    <ol className="space-y-0" aria-hidden="true">
      {WAITING_STAGES.map((stage, i) => {
        const state = states[i]!;
        const last = i === WAITING_STAGES.length - 1;
        return (
          <li key={stage.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="flex size-3.5 shrink-0 items-center justify-center">
                {state === "done" ? (
                  <Check className="text-success size-3.5" />
                ) : state === "active" ? (
                  <span className="relative flex size-3.5 items-center justify-center">
                    <span className="bg-primary/30 absolute inline-flex size-3.5 animate-ping rounded-full motion-reduce:hidden" />
                    <span className="bg-primary relative size-2 rounded-full" />
                  </span>
                ) : (
                  <span className="bg-border size-1.5 rounded-full" />
                )}
              </span>
              {!last ? (
                <span
                  style={{ minHeight: "0.75rem" }}
                  className={cn(
                    "my-1 w-px grow rounded-full transition-colors duration-500",
                    state === "done" ? "bg-primary" : "bg-border",
                  )}
                />
              ) : null}
            </div>
            <span
              className={cn(
                "text-sm transition-colors duration-500",
                last ? "pb-0" : "pb-3",
                state === "active"
                  ? "text-foreground font-medium"
                  : state === "done"
                    ? "text-muted-foreground"
                    : "text-muted-foreground/40",
              )}
            >
              {stage.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
