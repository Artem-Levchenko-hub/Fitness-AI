"use client";

import { useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";

import { pickRandomDemoGif } from "@/lib/domain/exercises/demos";
import { cn } from "@/lib/utils/index";

import { StickmanLoader } from "./StickmanLoader";

/** Лоадер ожидания разбора: СЛУЧАЙНАЯ demo-гифка упражнения (новая на каждый
 *  показ ожидания). При prefers-reduced-motion и до маунта рисуем статичный
 *  векторный StickmanLoader: гифки автоиграют и не уважают reduce — для
 *  reduce-motion это нарушение (R-41). Белая «плитка» под гифкой совпадает с её
 *  белым фоном → гифка садится ровно, без грязных краёв в обеих темах. Гифка
 *  стабильна всё ожидание (не слайд-шоу) — один рандом за маунт. */
export function RandomDemoLoader({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const [gif, setGif] = useState<string | null>(null);

  // Рандом выбираем ТОЛЬКО на клиенте после маунта: на сервере/первой гидрации
  // gif=null → StickmanLoader (совпадает с SSR, нет hydration mismatch), затем
  // эффект подставляет случайную гифку. Одноразовый client-side side-effect —
  // set-state-in-effect здесь оправдан (нельзя выбрать на сервере: SSR и клиент
  // выбрали бы РАЗНЫЕ гифки).
  useEffect(() => {
    if (reduced) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot client-only pick, see comment
    setGif(pickRandomDemoGif(Math.random));
  }, [reduced]);

  if (reduced || !gif) {
    return <StickmanLoader className={className} />;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "border-border relative overflow-hidden rounded-2xl border bg-white",
        className,
      )}
    >
      <Image
        src={gif}
        alt=""
        aria-hidden="true"
        fill
        unoptimized
        sizes="160px"
        className="object-contain p-2"
      />
      <span className="sr-only">Тренер готовит разбор</span>
    </div>
  );
}
