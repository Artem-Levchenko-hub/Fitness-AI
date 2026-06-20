"use client";

import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils/index";

/** Лоадер ожидания разбора. Был: сырая ExerciseDB-гифка на белом фоне — выбивалась
 *  из тёплой палитры и читалась «допотопно». Стал: смысловой штангистский «повтор»
 *  векторной графикой (бренд-sage, прозрачный фон) с плавным bob через Framer
 *  (easeInOut, бесконечный) — встаёт в палитру, ощущается премиально.
 *  prefers-reduced-motion → статичная поза (Framer уважает reduce: пустой animate). */

const LOOP = { duration: 1.6, ease: "easeInOut", repeat: Infinity } as const;

export function StickmanLoader({ className }: { className?: string }) {
  const reduced = useReducedMotion();

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center justify-center", className)}
    >
      <svg viewBox="0 0 120 120" className="size-full" aria-hidden="true">
        {/* Опора-тень на «полу» — пульсирует в противофазе подъёму штанги. */}
        <motion.ellipse
          cx="60"
          cy="106"
          rx="34"
          ry="5"
          className="fill-primary/15"
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
          animate={reduced ? undefined : { scaleX: [1, 0.7, 1], opacity: [0.5, 0.22, 0.5] }}
          transition={LOOP}
        />
        {/* Штанга поднимается и опускается, как один повтор. */}
        <motion.g
          animate={reduced ? undefined : { y: [0, -26, 0] }}
          transition={LOOP}
        >
          {/* Гриф */}
          <rect
            x="26"
            y="54"
            width="68"
            height="6"
            rx="3"
            className="fill-muted-foreground/60"
          />
          {/* Блины с «дыркой» под цвет карточки — читаются как реальные диски. */}
          <circle cx="32" cy="57" r="19" className="fill-primary" />
          <circle cx="32" cy="57" r="6.5" className="fill-card" />
          <circle cx="88" cy="57" r="19" className="fill-primary" />
          <circle cx="88" cy="57" r="6.5" className="fill-card" />
        </motion.g>
      </svg>
      <span className="sr-only">Тренер готовит разбор</span>
    </div>
  );
}
