"use client";

import { useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";

import { pickRandomDemoGif } from "@/lib/domain/exercises/demos";

import { StickmanLoader } from "./StickmanLoader";

/** Позиции плывущих частиц вокруг ядра (детерминированы — без Math.random в
 *  разметке; разный delay создаёт непрерывный поток). */
const MOTES = [
  { left: "20%", top: "32%", delay: "0s" },
  { left: "76%", top: "44%", delay: "1.2s" },
  { left: "62%", top: "22%", delay: "2.4s" },
  { left: "34%", top: "74%", delay: "1.8s" },
];

/** «Аура» — вау-портал ожидания разбора. В центре круглое ядро со СЛУЧАЙНОЙ
 *  demo-гифкой упражнения; вокруг — дышащие sage-кольца (sonar-рябь), медленно
 *  вращающаяся conic-дуга «тренер думает» и плывущие частицы. Момент
 *  антиципации: «тренер канализирует твои данные».
 *
 *  prefers-reduced-motion и до маунта → спокойный статичный StickmanLoader:
 *  гифки автоиграют и не уважают reduce (R-41), а аура без движения смысла не
 *  имеет; статичный фолбэк ещё и совпадает с SSR/первой гидрацией → нет
 *  hydration mismatch. Рандом гифки — один раз на маунт, на клиенте. Весь блок
 *  декоративный (aria-hidden): статус озвучивает внешний TrainerSkeleton. */
export function TrainerAura() {
  const reduced = useReducedMotion();
  const [gif, setGif] = useState<string | null>(null);

  useEffect(() => {
    if (reduced) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot client-only pick, SSR-safe (see TrainerAura doc)
    setGif(pickRandomDemoGif(Math.random));
  }, [reduced]);

  if (reduced || !gif) {
    return (
      <div className="flex h-52 items-center justify-center">
        <StickmanLoader className="size-28" />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="relative mx-auto flex h-52 w-52 items-center justify-center"
    >
      {/* Атмосферное sage-свечение — мягко пульсирует. */}
      <div className="trainer-aura-glow absolute inset-0 rounded-full" />

      {/* Дышащие кольца — рябь наружу, со сдвигом фаз → непрерывное «дыхание». */}
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="trainer-aura-ring absolute size-40 rounded-full"
          style={{ animationDelay: `${i * 1.4}s` }}
        />
      ))}

      {/* Вращающаяся дуга «думаю» — conic-маска по кольцу. */}
      <div className="trainer-aura-scan absolute size-44 rounded-full" />

      {/* Ядро: круглый портал с гифкой (белый фон гифки = тело портала),
          обёрнутый sage-свечением (trainer-aura-core) — читается в обеих темах. */}
      <div className="trainer-aura-core relative size-28 overflow-hidden rounded-full">
        <Image
          src={gif}
          alt=""
          fill
          unoptimized
          sizes="120px"
          className="bg-white object-contain p-1"
        />
      </div>

      {/* Плывущие частицы. */}
      {MOTES.map((m, i) => (
        <span
          key={i}
          className="trainer-aura-mote absolute size-1.5 rounded-full"
          style={{ left: m.left, top: m.top, animationDelay: m.delay }}
        />
      ))}
    </div>
  );
}
