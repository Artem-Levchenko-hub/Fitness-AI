"use client";

import { BookOpen, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { toInsightCard, type InsightChunk } from "@/lib/ai/insight-card";
import { cn } from "@/lib/utils/index";

/** H16.2 — «книжные факты под сессию» в момент ожидания разбора.
 *
 *  Самостоятельный слой ПОВЕРХ живого лоадера (паттерн GoFundMe «Did you
 *  know?»): пока тренер думает (15–45с), показываем реальные факты из книги
 *  под мышцы/упражнения этой сессии. Fail-soft по композиции (R-10/R-37): RAG
 *  упал / нет релевантных кусков / эндпоинт 500 → рендерим null, а лоадер под
 *  нами живёт сам. Источник — `/api/ai/trainer/insights` (RAG ≈1с ≪ разбор),
 *  никакой LLM-генерации. */

const AUTO_ADVANCE_MS = 9000;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

export function InsightCards({
  workoutId,
  circuitWorkoutId,
}: {
  /** Силовая тренировка — факты по её упражнениям (H16.2). */
  workoutId?: string;
  /** Круговая — факты по её упражнениям (H16.3). Передаётся вместо workoutId. */
  circuitWorkoutId?: string;
}) {
  const [chunks, setChunks] = useState<InsightChunk[]>([]);
  const [index, setIndex] = useState(0);
  const liveRef = useRef(true);

  // Какой id-параметр кормит /insights (силовая vs круговая). Один из двух.
  const queryParam = workoutId
    ? `workoutId=${encodeURIComponent(workoutId)}`
    : circuitWorkoutId
      ? `circuitWorkoutId=${encodeURIComponent(circuitWorkoutId)}`
      : null;

  // Тянем факты один раз под эту тренировку. AbortController — чистый cleanup.
  useEffect(() => {
    if (!queryParam) return;
    liveRef.current = true;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(
          `/api/ai/trainer/insights?${queryParam}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!res.ok) return; // fail-soft: лоадер живёт без карточек
        const data = (await res.json()) as { chunks?: InsightChunk[] };
        if (liveRef.current && Array.isArray(data.chunks)) {
          setChunks(data.chunks);
        }
      } catch {
        // Сеть/abort — карточки просто не появятся, разбор это не блокирует.
      }
    })();

    return () => {
      liveRef.current = false;
      controller.abort();
    };
  }, [queryParam]);

  // Автопрокрутка фактов — только если их больше одного и не reduced-motion.
  useEffect(() => {
    if (chunks.length < 2 || prefersReducedMotion()) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % chunks.length);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [chunks.length]);

  if (chunks.length === 0) return null;

  const safeIndex = index % chunks.length;
  const card = toInsightCard(chunks[safeIndex]!);

  return (
    <section
      aria-label="Факт из книги, пока готовится разбор"
      className="border-border bg-accent/40 space-y-3 rounded-2xl border p-5"
    >
      <p className="text-muted-foreground flex items-center gap-2 text-[11px] font-medium tracking-[0.14em] uppercase">
        <BookOpen className="text-primary size-3.5 shrink-0" />
        Пока тренер думает — факт из книги
      </p>

      <p key={safeIndex} className="text-foreground text-sm leading-relaxed">
        {card.text}
      </p>

      <p className="text-muted-foreground text-xs italic">{card.citation}</p>

      {chunks.length > 1 ? (
        <div className="flex items-center justify-between pt-1">
          <ul className="flex items-center gap-1.5" aria-hidden="true">
            {chunks.map((_, i) => (
              <li
                key={i}
                className={cn(
                  "size-1.5 rounded-full transition-colors",
                  i === safeIndex ? "bg-primary" : "bg-border",
                )}
              />
            ))}
          </ul>

          <button
            type="button"
            onClick={() => setIndex((i) => (i + 1) % chunks.length)}
            className="text-primary focus-visible:ring-ring -mr-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
          >
            Дальше
            <ChevronRight className="size-4" />
          </button>
        </div>
      ) : null}
    </section>
  );
}
