"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/** Ровный ритм печати поверх «бурстящего» стрима: показываем накопленный target
 *  по символам с постоянной скоростью (rAF), сглаживая рывки доставки токенов.
 *  Большой backlog (уже готовое поле) добираем быстрее, живой хвост печатаем
 *  плавно. Внутри одного поля target только растёт (новые токены), поэтому
 *  прогресс не сбрасываем между ре-рендерами. prefers-reduced-motion → сразу
 *  весь текст без анимации. */
export function useTypewriter(target: string, charsPerSec = 90): string {
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return; // reduced → возвращаем target целиком ниже, без setState

    let raf = 0;
    let last: number | null = null;

    const tick = (t: number) => {
      if (last == null) last = t;
      const dt = (t - last) / 1000;
      last = t;

      if (shownRef.current < target.length) {
        const backlog = target.length - shownRef.current;
        const step = Math.max(
          Math.ceil(backlog / 6), // длинный хвост готового поля — добираем быстро
          Math.round(charsPerSec * dt),
          1,
        );
        shownRef.current = Math.min(target.length, shownRef.current + step);
        setShown(shownRef.current);
      }

      if (shownRef.current < target.length) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, charsPerSec, reduced]);

  if (reduced) return target;
  return target.slice(0, Math.min(shown, target.length));
}
