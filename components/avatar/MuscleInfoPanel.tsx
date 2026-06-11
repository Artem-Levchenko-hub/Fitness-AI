"use client";

import { Dumbbell, X } from "lucide-react";

import type { AvatarMuscleDatum } from "./types";

/** Оверлей-панель при тапе на мышцу. Прогрессивный цикл: тоннаж → подходы →
 *  последняя тренировка → топ-3 упражнения. Повторный тап (по мышце или по
 *  панели) листает цикл; все данные уже в datum — без сетевых запросов.
 *  Обычный DOM поверх canvas (легче и доступнее drei <Html>). */

const CYCLE_LEN = 4;

type Props = {
  datum: AvatarMuscleDatum | null;
  cycle: number;
  onAdvance: () => void;
  onClose: () => void;
};

export function MuscleInfoPanel({ datum, cycle, onAdvance, onClose }: Props) {
  if (!datum) {
    return (
      <div className="border-border bg-card/80 text-muted-foreground supports-[backdrop-filter]:bg-card/60 pointer-events-none rounded-2xl border px-4 py-3 text-center text-sm backdrop-blur-sm">
        Нажми на мышцу, чтобы увидеть детали
      </div>
    );
  }

  const step = ((cycle % CYCLE_LEN) + CYCLE_LEN) % CYCLE_LEN;

  return (
    <div className="border-border bg-card/85 supports-[backdrop-filter]:bg-card/70 rounded-2xl border p-4 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="size-3.5 shrink-0 rounded-full"
            style={{ backgroundColor: datum.color }}
            aria-hidden="true"
          />
          <div>
            <h3 className="text-base font-semibold tracking-tight">
              {datum.label}
            </h3>
            <p className="text-muted-foreground text-xs">{datum.levelLabel}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="text-muted-foreground hover:text-foreground -m-1 p-1"
        >
          <X className="size-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={onAdvance}
        className="mt-3 block w-full text-left"
        aria-label="Показать следующий показатель"
      >
        <CycleField datum={datum} step={step} />
      </button>

      <div
        className="mt-3 flex items-center justify-center gap-1.5"
        aria-hidden="true"
      >
        {Array.from({ length: CYCLE_LEN }).map((_, i) => (
          <span
            key={i}
            className={
              i === step
                ? "bg-foreground size-1.5 rounded-full"
                : "bg-muted-foreground/30 size-1.5 rounded-full"
            }
          />
        ))}
      </div>
    </div>
  );
}

function CycleField({
  datum,
  step,
}: {
  datum: AvatarMuscleDatum;
  step: number;
}) {
  if (step === 0) {
    return (
      <Stat
        big={`${Math.round(datum.volume7d).toLocaleString("ru")}`}
        unit="кг·повт"
        caption="тоннаж за 7 дней"
      />
    );
  }
  if (step === 1) {
    return (
      <Stat
        big={String(datum.sets)}
        unit={pluralSets(datum.sets)}
        caption="за 7 дней"
      />
    );
  }
  if (step === 2) {
    return (
      <div>
        <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
          Последняя тренировка
        </p>
        <p className="font-serif mt-1 text-2xl font-normal tracking-tight">
          {datum.lastTrainedLabel}
        </p>
      </div>
    );
  }
  // step === 3 — топ-3 упражнения
  return (
    <div>
      <p className="text-muted-foreground mb-2 text-[10px] font-medium tracking-wide uppercase">
        Топ упражнения за 7 дней
      </p>
      {datum.top3.length === 0 ? (
        <p className="text-muted-foreground text-sm">Нет данных за неделю.</p>
      ) : (
        <ul className="space-y-1.5">
          {datum.top3.map((ex) => (
            <li
              key={ex.name}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Dumbbell
                  className="text-muted-foreground size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span className="truncate">{ex.name}</span>
              </span>
              <span className="text-muted-foreground tabular shrink-0 text-xs">
                {Math.round(ex.volume).toLocaleString("ru")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({
  big,
  unit,
  caption,
}: {
  big: string;
  unit: string;
  caption: string;
}) {
  return (
    <div>
      <p className="tabular font-serif text-3xl font-normal tracking-tight">
        {big}{" "}
        <span className="text-muted-foreground text-base font-sans">
          {unit}
        </span>
      </p>
      <p className="text-muted-foreground mt-0.5 text-xs">{caption}</p>
    </div>
  );
}

function pluralSets(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "подход";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
    return "подхода";
  return "подходов";
}
