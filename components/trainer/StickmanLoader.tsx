"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils/index";

/** H16.4 — стикман-лоадер ожидания разбора вместо спиннера-«кружка». Атлет
 *  ЖМЁТ / ПРИСЕДАЕТ / ПОДТЯГИВАЕТСЯ — вариант выбирается случайно при монтировании.
 *  Анимация — CSS-keyframes по transform одной SVG-группы (globals.css:
 *  stickman-*) — GPU-friendly 60fps. prefers-reduced-motion гасит длительность
 *  глобальным правилом → статичная поза без дёрганья (R-41/перф-столп).
 *
 *  SSR-безопасность: первый пэйнт (сервер + первый клиент) всегда «squat», рандом
 *  выставляется в эффекте — ноль hydration-рассинхрона (тот же приём, что в
 *  TrainerStages с elapsed=0). */

type Variant = "squat" | "press" | "pull";

const VARIANTS: readonly Variant[] = ["squat", "press", "pull"];

const VERB: Record<Variant, string> = {
  squat: "приседает",
  press: "жмёт",
  pull: "подтягивается",
};

const STROKE = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function StickmanLoader({ className }: { className?: string }) {
  const [variant, setVariant] = useState<Variant>("squat");

  // setVariant через таймер-callback, а не синхронно в теле эффекта — иначе
  // react-hooks/set-state-in-effect. SSR/первый пэйнт = «squat», затем рандом.
  useEffect(() => {
    const t = setTimeout(() => {
      setVariant(VARIANTS[Math.floor(Math.random() * VARIANTS.length)]!);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("text-primary", className)}
    >
      <svg
        viewBox="0 0 100 100"
        className="size-full"
        aria-hidden="true"
        focusable="false"
      >
        {variant === "squat" ? (
          <SquatFigure />
        ) : variant === "press" ? (
          <PressFigure />
        ) : (
          <PullFigure />
        )}
      </svg>
      <span className="sr-only">Тренер думает — атлет {VERB[variant]}</span>
    </div>
  );
}

/** Присед: вся фигура со штангой на плечах ритмично опускается и встаёт. */
function SquatFigure() {
  return (
    <>
      {/* пол — фиксированный ориентир */}
      <line
        x1="18"
        y1="92"
        x2="82"
        y2="92"
        className="text-muted-foreground/40"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <g
        className="stickman-move"
        style={{ animation: "stickman-squat 2.2s ease-in-out infinite" }}
      >
        {/* штанга на плечах + блины */}
        <line x1="24" y1="33" x2="76" y2="33" {...STROKE} />
        <circle cx="24" cy="33" r="4.5" fill="currentColor" />
        <circle cx="76" cy="33" r="4.5" fill="currentColor" />
        {/* руки к грифу */}
        <line x1="50" y1="42" x2="32" y2="33" {...STROKE} />
        <line x1="50" y1="42" x2="68" y2="33" {...STROKE} />
        {/* голова + корпус */}
        <circle cx="50" cy="24" r="6" {...STROKE} />
        <line x1="50" y1="30" x2="50" y2="58" {...STROKE} />
        {/* ноги */}
        <line x1="50" y1="58" x2="39" y2="80" {...STROKE} />
        <line x1="50" y1="58" x2="61" y2="80" {...STROKE} />
      </g>
    </>
  );
}

/** Жим над головой: корпус и ноги стоят, штанга с руками ходит вверх-вниз. */
function PressFigure() {
  return (
    <>
      <line
        x1="18"
        y1="92"
        x2="82"
        y2="92"
        className="text-muted-foreground/40"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* неподвижная фигура */}
      <circle cx="50" cy="34" r="6" {...STROKE} />
      <line x1="50" y1="40" x2="50" y2="64" {...STROKE} />
      <line x1="50" y1="64" x2="40" y2="88" {...STROKE} />
      <line x1="50" y1="64" x2="60" y2="88" {...STROKE} />
      {/* штанга + руки — жмут вверх-вниз */}
      <g
        className="stickman-move"
        style={{ animation: "stickman-press 1.9s ease-in-out infinite" }}
      >
        <line x1="24" y1="26" x2="76" y2="26" {...STROKE} />
        <circle cx="24" cy="26" r="4.5" fill="currentColor" />
        <circle cx="76" cy="26" r="4.5" fill="currentColor" />
        <line x1="50" y1="42" x2="33" y2="26" {...STROKE} />
        <line x1="50" y1="42" x2="67" y2="26" {...STROKE} />
      </g>
    </>
  );
}

/** Подтягивание: перекладина закреплена сверху, тело подтягивается к ней. */
function PullFigure() {
  return (
    <>
      {/* перекладина — фиксированная */}
      <line
        x1="14"
        y1="16"
        x2="86"
        y2="16"
        className="text-muted-foreground/40"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <g
        className="stickman-move"
        style={{ animation: "stickman-pull 2s ease-in-out infinite" }}
      >
        {/* руки на перекладине */}
        <line x1="40" y1="18" x2="50" y2="42" {...STROKE} />
        <line x1="60" y1="18" x2="50" y2="42" {...STROKE} />
        {/* голова + корпус */}
        <circle cx="50" cy="48" r="6" {...STROKE} />
        <line x1="50" y1="54" x2="50" y2="74" {...STROKE} />
        {/* ноги слегка согнуты */}
        <line x1="50" y1="74" x2="43" y2="90" {...STROKE} />
        <line x1="50" y1="74" x2="57" y2="90" {...STROKE} />
      </g>
    </>
  );
}
