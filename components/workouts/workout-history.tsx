import { ChevronRight, Sparkles } from "lucide-react";
import Link from "next/link";

import type { CardioPresetKind } from "@/lib/domain/cardio/presets";
import {
  buildHistory,
  countWeekSessions,
  type HistoryItem,
} from "@/lib/domain/workouts/history";

// Слияние истории — чистая доменная логика (lib/domain/workouts/history.ts),
// здесь только её реэкспорт + отрисовка. Существующие импортёры (дашборд,
// /workouts) тянут buildHistory/HistoryItem отсюда без изменений.
export { buildHistory, countWeekSessions };
export type { HistoryItem };

const CARDIO_FORMAT_LABEL: Record<CardioPresetKind, string> = {
  tabata: "Tabata",
  norwegian_4x4: "4×4",
  emom: "EMOM",
  custom: "Кардио",
};

const FORMAT_HREF: Record<HistoryItem["kind"], string> = {
  strength: "/workouts",
  circuit: "/circuits",
  cardio: "/cardio",
};

export function HistoryCard({ item }: { item: HistoryItem }) {
  const href = `${FORMAT_HREF[item.kind]}/${item.id}`;

  return (
    <Link
      href={href}
      className="interactive-surface bg-card hover:bg-accent/40 border-border hover:border-primary/25 focus-visible:ring-ring block rounded-2xl border p-4 focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
              {formatShortDate(item.startedAt)}
            </p>
            <FormatPill label={formatLabel(item)} />
          </div>
          <h3 className="mt-0.5 truncate text-base font-semibold tracking-tight">
            {item.name}
          </h3>
          <HistoryMetrics item={item} />
        </div>
        <div className="flex flex-col items-end gap-2">
          {(item.kind === "strength" || item.kind === "circuit") &&
          item.hasAnalysis ? (
            <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
              <Sparkles className="size-3" />
              AI
            </span>
          ) : null}
          <ChevronRight
            className="text-muted-foreground size-4"
            aria-hidden="true"
          />
        </div>
      </div>
    </Link>
  );
}

/** Компактный тайл «Последняя» для дашборда: отражает последнюю сессию
 *  ЛЮБОГО формата (силовая/круговая/кардио), а не только силовую — единый
 *  поток. Одна заглавная метрика на формат, ведёт в свой detail-роут. */
export function LastSessionMini({ item }: { item: HistoryItem }) {
  const href = `${FORMAT_HREF[item.kind]}/${item.id}`;

  return (
    <Link
      href={href}
      className="interactive-surface bg-card hover:bg-accent/40 border-border hover:border-primary/25 focus-visible:ring-ring block rounded-2xl border p-4 focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
          Последняя
        </p>
        <FormatPill label={formatLabel(item)} />
      </div>
      <p className="mt-1 truncate text-base font-semibold tracking-tight">
        {item.name}
      </p>
      <p className="text-muted-foreground mt-0.5 text-xs">
        {formatShortDate(item.startedAt)}
      </p>
      <div className="text-muted-foreground tabular mt-3 flex items-center justify-between text-xs">
        <span>{lastSessionHeadline(item)}</span>
        {(item.kind === "strength" || item.kind === "circuit") &&
        item.hasAnalysis ? (
          <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase">
            <Sparkles className="size-3" />
            AI
          </span>
        ) : null}
      </div>
    </Link>
  );
}

/** Одна короткая метрика-заголовок на формат для компактного тайла. */
function lastSessionHeadline(item: HistoryItem): string {
  switch (item.kind) {
    case "strength":
      return `${item.setCount} подходов`;
    case "circuit":
      return `${item.totalRounds} кругов · ${item.exerciseCount} упр.`;
    case "cardio": {
      const sec = item.totalActualSec || item.totalPlannedSec;
      const min = sec > 0 ? Math.max(1, Math.round(sec / 60)) : null;
      return min !== null ? `${min} мин` : CARDIO_FORMAT_LABEL[item.preset];
    }
  }
}

function FormatPill({ label }: { label: string }) {
  return (
    <span className="bg-muted/60 text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
      {label}
    </span>
  );
}

function formatLabel(item: HistoryItem): string {
  switch (item.kind) {
    case "strength":
      return "Силовая";
    case "circuit":
      return "Круговая";
    case "cardio":
      return CARDIO_FORMAT_LABEL[item.preset];
  }
}

function HistoryMetrics({ item }: { item: HistoryItem }) {
  switch (item.kind) {
    case "strength": {
      const min = durationMinutes(item.startedAt, item.finishedAt);
      return (
        <dl className="text-muted-foreground tabular mt-3 grid grid-cols-3 gap-3 text-xs">
          <KPI label="подходов" value={String(item.setCount)} />
          <KPI
            label="kg·reps"
            value={Math.round(item.tonnageKg).toLocaleString("ru-RU")}
          />
          <KPI label="мин" value={min?.toString() ?? "—"} />
        </dl>
      );
    }
    case "circuit":
      return (
        <dl className="text-muted-foreground tabular mt-3 grid grid-cols-3 gap-3 text-xs">
          <KPI label="кругов" value={String(item.totalRounds)} />
          <KPI label="упр." value={String(item.exerciseCount)} />
          <KPI
            label="мин"
            value={
              durationMinutes(item.startedAt, item.finishedAt)?.toString() ??
              "—"
            }
          />
        </dl>
      );
    case "cardio": {
      const sec = item.totalActualSec || item.totalPlannedSec;
      const min = sec > 0 ? Math.max(1, Math.round(sec / 60)) : null;
      return (
        <dl className="text-muted-foreground tabular mt-3 grid grid-cols-3 gap-3 text-xs">
          <KPI label="мин" value={min?.toString() ?? "—"} />
          <KPI label="bpm" value={item.hrAvg?.toString() ?? "—"} />
          <KPI label="формат" value={CARDIO_FORMAT_LABEL[item.preset]} />
        </dl>
      );
    }
  }
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-foreground tabular text-sm font-semibold">{value}</p>
      <p className="mt-0.5">{label}</p>
    </div>
  );
}

function durationMinutes(
  startedAt: Date,
  finishedAt: Date | null,
): number | null {
  if (!finishedAt) return null;
  return Math.max(
    1,
    Math.round((finishedAt.getTime() - startedAt.getTime()) / 60_000),
  );
}

function formatShortDate(d: Date): string {
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return `Сегодня · ${d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) {
    return `Вчера · ${d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    weekday: "short",
  });
}
