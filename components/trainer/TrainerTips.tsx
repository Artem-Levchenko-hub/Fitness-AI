"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { Fragment, useEffect, useState } from "react";

import { shuffleTips, TRAINER_TIPS, type TrainerTip } from "@/lib/trainer/tips";

/** H16.4 — карусель коротких советов/ликбезов, пока тренер готовит разбор.
 *  Заменяет прежний сырой book-text дамп: курируемые советы (1–3 строки, жирные
 *  акценты), РАНДОМНЫЙ порядок, авто-смена каждые ~10с с плавным переходом
 *  (Framer Motion). Чистый клиент, без сети — работает всегда (даже офлайн).
 *
 *  SSR-безопасность: сервер и первый клиентский пэйнт показывают исходный
 *  порядок с index 0; перемешивание и авто-смена включаются в эффекте (только
 *  клиент) → ноль hydration-рассинхрона. prefers-reduced-motion: без авто-смены
 *  и без бегущей полосы — спокойный статичный совет + ручное «Дальше». */

const ADVANCE_MS = 10000;

const CATEGORY_LABEL: Record<string, string> = {
  glossary: "Ликбез",
  technique: "Техника",
  "technique-extra": "Техника",
  progression: "Прогрессия",
  "progression-extra": "Прогрессия",
  "volume-intensity": "Объём и интенсивность",
  recovery: "Восстановление",
  nutrition: "Питание",
  "mistakes-myths": "Мифы и ошибки",
  "warmup-safety": "Разминка и безопасность",
  "hypertrophy-science": "Наука о росте",
  "motivation-habits": "Привычки",
  "mindset-extra": "Голова и режим",
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/** Рендерит body совета: переносы строк (\n) → строки, инлайн **жирный** →
 *  <strong>. Без полноценного markdown — только акценты, которые задаёт контент. */
function renderBody(body: string) {
  return body.split("\n").map((line, li) => (
    <span key={li} className="block">
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="text-foreground font-semibold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </span>
  ));
}

export function TrainerTips() {
  const [order, setOrder] = useState<readonly TrainerTip[]>(TRAINER_TIPS);
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(false);

  // Перемешиваем один раз на клиенте (рандомный порядок при каждом ожидании).
  // setState через таймер-callback, а не синхронно в теле эффекта — иначе
  // react-hooks/set-state-in-effect (каскадные ре-рендеры). SSR-порядок исходный.
  useEffect(() => {
    const t = setTimeout(() => {
      setReduced(prefersReducedMotion());
      setOrder(shuffleTips(TRAINER_TIPS));
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // Авто-смена ~10с. setTimeout (а не interval) перевзводится на каждой смене —
  // ручное «Дальше» сбрасывает отсчёт, и бегущая полоса всегда совпадает с ним.
  useEffect(() => {
    if (reduced || order.length < 2) return;
    const t = setTimeout(
      () => setIndex((i) => (i + 1) % order.length),
      ADVANCE_MS,
    );
    return () => clearTimeout(t);
  }, [index, order.length, reduced]);

  if (order.length === 0) return null;

  const tip = order[index % order.length]!;
  const categoryLabel = CATEGORY_LABEL[tip.category];
  const next = () => setIndex((i) => (i + 1) % order.length);

  return (
    <section
      aria-label="Совет, пока готовится разбор"
      aria-live="polite"
      className="border-border bg-accent/40 rounded-2xl border p-5"
    >
      <div className="text-muted-foreground mb-3 flex items-center justify-between gap-2 text-[11px] font-medium tracking-[0.14em] uppercase">
        <span className="flex items-center gap-2">
          <BookOpen className="text-primary size-3.5 shrink-0" />
          Пока тренер думает
        </span>
        {categoryLabel ? (
          <span className="text-primary bg-primary/10 rounded-full px-2 py-0.5 text-[10px] tracking-[0.08em]">
            {categoryLabel}
          </span>
        ) : null}
      </div>

      <div className="min-h-[92px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <h3 className="text-foreground text-base font-semibold tracking-tight">
              {tip.title}
            </h3>
            <div className="text-muted-foreground mt-1.5 space-y-0.5 text-sm leading-relaxed">
              {renderBody(tip.body)}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {order.length > 1 ? (
        <div className="mt-4 flex items-center gap-3">
          {/* Бегущая полоса — таймер до смены совета. Под reduced-motion скрыта. */}
          <div className="bg-border h-1 flex-1 overflow-hidden rounded-full">
            {!reduced ? (
              <motion.div
                key={index}
                className="bg-primary h-full"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: ADVANCE_MS / 1000, ease: "linear" }}
              />
            ) : null}
          </div>
          <button
            type="button"
            onClick={next}
            className="text-primary focus-visible:ring-ring -mr-1 inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
          >
            Дальше
          </button>
        </div>
      ) : null}
    </section>
  );
}
