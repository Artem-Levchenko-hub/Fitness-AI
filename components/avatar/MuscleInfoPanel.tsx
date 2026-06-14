"use client";

import { ChevronRight, Dumbbell, Snowflake, Trophy, X } from "lucide-react";
import Link from "next/link";

import { forgottenLabel } from "@/lib/domain/avatar/forgotten";

import type { AvatarMuscleDatum } from "./types";

/** Оверлей-панель при тапе на мышцу. Прогрессивный цикл: тоннаж → подходы →
 *  последняя тренировка → топ-3 → рекорды → тоннаж по неделям (H17.1). Повторный
 *  тап (по мышце или по панели) листает цикл; все данные уже в datum — без
 *  сетевых запросов. Обычный DOM поверх canvas (легче и доступнее drei <Html>). */

/** Число показателей в цикле панели. Экспортируется как единственный источник
 *  правды — обёртка (ProfileAvatar) берёт его же для модуля счётчика тапов.
 *  Шаги: 0 тоннаж 7д · 1 подходы · 2 последняя тренировка · 3 топ-3 ·
 *  4 рекорды · 5 тоннаж по неделям (H17.1). */
export const CYCLE_LEN = 6;

type Props = {
  datum: AvatarMuscleDatum | null;
  cycle: number;
  onAdvance: () => void;
  onClose: () => void;
  /** Делать упражнения в панели ссылками на /exercises/[id] (история подходов).
   *  Только на своём /profile — на профиле друга страница показала бы историю
   *  смотрящего, а не друга, поэтому там ссылок нет (default false). */
  linkExercises?: boolean;
};

export function MuscleInfoPanel({
  datum,
  cycle,
  onAdvance,
  onClose,
  linkExercises = false,
}: Props) {
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
            {datum.forgottenWeeks != null ? (
              <p className="text-muted-foreground mt-1 inline-flex items-center gap-1 text-xs font-medium">
                <Snowflake className="size-3.5 shrink-0" aria-hidden="true" />
                {forgottenLabel(datum.forgottenWeeks)}
              </p>
            ) : null}
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

      {step <= 2 || step === 5 ? (
        <button
          type="button"
          onClick={onAdvance}
          className="mt-3 block w-full text-left"
          aria-label="Показать следующий показатель"
        >
          <CycleField datum={datum} step={step} />
        </button>
      ) : (
        // Списки упражнений (топ-3 / рекорды) — строки могут быть ссылками, а
        // <a> внутри <button> невалиден, поэтому здесь отдельный блок: ярлык
        // листает цикл, строки навигируют (см. ExerciseListField).
        <ExerciseListField
          datum={datum}
          step={step}
          onAdvance={onAdvance}
          linkExercises={linkExercises}
        />
      )}

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
  if (step === 5) {
    return <WeeklyVolumeField series={datum.weeklyVolume} />;
  }
  // step 0..2 и 5 здесь; списки упражнений (3 — топ за неделю, 4 — рекорды)
  // рендерит ExerciseListField (строки-ссылки на /exercises/[id]).
  return null;
}

/** H17.1 — тоннаж группы по последним ISO-неделям (тело→время). Компактные
 *  столбики высотой ∝ значению + подписи тоннажа под крайними неделями. Пустой
 *  ряд (нет недельной истории) → пустое состояние (R-37). Только числа/высоты —
 *  headless-верифицируемо, без 3D и без анимации (YAGNI). */
function WeeklyVolumeField({ series }: { series: number[] }) {
  if (series.length === 0) {
    return (
      <div>
        <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
          Тоннаж по неделям
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          Нет недельной истории.
        </p>
      </div>
    );
  }

  const max = Math.max(...series);
  const first = Math.round(series[0]).toLocaleString("ru");
  const last = Math.round(series[series.length - 1]).toLocaleString("ru");

  return (
    <div>
      <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        Тоннаж по неделям
      </p>
      <div
        className="mt-2 flex h-12 items-end gap-1"
        data-weekly-volume={series.map((v) => Math.round(v)).join(",")}
      >
        {series.map((v, i) => (
          <span
            key={i}
            className="bg-foreground/70 min-h-0.5 flex-1 rounded-sm"
            style={{ height: max > 0 ? `${(v / max) * 100}%` : "2px" }}
            aria-hidden="true"
          />
        ))}
      </div>
      <p className="text-muted-foreground mt-1 flex items-center justify-between text-xs">
        <span>{series.length} нед.</span>
        <span className="tabular">
          {first} → {last} кг·повт
        </span>
      </p>
    </div>
  );
}

/** Списки упражнений группы: топ-3 за неделю (step 3) или all-time рекорды
 *  (step 4). Ярлык листает цикл (button → onAdvance), строки — ссылки на
 *  историю упражнения, когда `linkExercises` (только свой /profile). */
function ExerciseListField({
  datum,
  step,
  onAdvance,
  linkExercises,
}: {
  datum: AvatarMuscleDatum;
  step: number;
  onAdvance: () => void;
  linkExercises: boolean;
}) {
  const isRecords = step === 4;
  const label = isRecords ? "Рекорды группы" : "Топ упражнения за 7 дней";
  const emptyText = isRecords
    ? "Пока нет силовых рекордов."
    : "Нет данных за неделю.";
  const isEmpty = isRecords
    ? datum.records.length === 0
    : datum.top3.length === 0;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={onAdvance}
        aria-label="Показать следующий показатель"
        className="block w-full text-left"
      >
        <p className="text-muted-foreground mb-2 text-[10px] font-medium tracking-wide uppercase">
          {label}
        </p>
      </button>
      {isEmpty ? (
        <p className="text-muted-foreground text-sm">{emptyText}</p>
      ) : (
        <ul className="space-y-1">
          {isRecords
            ? datum.records.map((pr) => (
                <ExerciseRow
                  key={pr.exerciseId}
                  exerciseId={pr.exerciseId}
                  name={pr.name}
                  Icon={Trophy}
                  value={`${formatKg(pr.weightKg)} × ${pr.reps}`}
                  emphasize
                  link={linkExercises}
                />
              ))
            : datum.top3.map((ex) => (
                <ExerciseRow
                  key={ex.exerciseId}
                  exerciseId={ex.exerciseId}
                  name={ex.name}
                  Icon={Dumbbell}
                  value={Math.round(ex.volume).toLocaleString("ru")}
                  link={linkExercises}
                />
              ))}
        </ul>
      )}
    </div>
  );
}

/** Одна строка упражнения. `link` → тапабельная ссылка на /exercises/[id]
 *  (история подходов, тап ≥44px, R-41) с шевроном-аффордансом; иначе — статика
 *  (профиль друга). */
function ExerciseRow({
  exerciseId,
  name,
  Icon,
  value,
  emphasize = false,
  link,
}: {
  exerciseId: string;
  name: string;
  Icon: typeof Dumbbell;
  value: string;
  emphasize?: boolean;
  link: boolean;
}) {
  const valueCls = emphasize
    ? "tabular shrink-0 text-xs font-medium"
    : "text-muted-foreground tabular shrink-0 text-xs";
  const nameNode = (
    <span className="flex min-w-0 items-center gap-2">
      <Icon
        className="text-muted-foreground size-3.5 shrink-0"
        aria-hidden="true"
      />
      <span className="truncate">{name}</span>
    </span>
  );

  if (!link) {
    return (
      <li className="flex items-center justify-between gap-3 text-sm">
        {nameNode}
        <span className={valueCls}>{value}</span>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={`/exercises/${exerciseId}`}
        aria-label={`История упражнения: ${name}`}
        className="hover:bg-muted/60 -mx-2 flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 text-sm transition-colors"
      >
        {nameNode}
        <span className="flex shrink-0 items-center gap-1">
          <span className={valueCls}>{value}</span>
          <ChevronRight
            className="text-muted-foreground/60 size-4"
            aria-hidden="true"
          />
        </span>
      </Link>
    </li>
  );
}

function formatKg(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : kg.toFixed(1);
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
