import { Activity, ChevronRight, Dumbbell, Play, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import type { CardioPresetKind } from "@/lib/domain/cardio/presets";
import {
  listRecentCardio,
  type CardioSummary,
} from "@/lib/repos/cardio.repo";
import {
  listCircuits,
  type CircuitSummary,
} from "@/lib/repos/circuits.repo";
import {
  getActiveWorkoutId,
  listRecentWorkouts,
  type RecentWorkout,
} from "@/lib/repos/workouts.repo";

export const metadata: Metadata = { title: "Тренировки" };

export default async function WorkoutsPage() {
  const user = await requireUser();
  const [strength, circuits, cardio, activeId] = await Promise.all([
    listRecentWorkouts(user.id, 60),
    listCircuits(user.id, 60),
    listRecentCardio(user.id, 60),
    getActiveWorkoutId(user.id),
  ]);

  const items = buildHistory(strength, circuits, cardio);
  const groups = groupByWeek(items);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <header className="mb-6">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          История
        </p>
        <h1 className="font-serif mt-1 text-4xl font-normal tracking-tight md:text-5xl">
          Тренировки
        </h1>
      </header>

      {activeId ? <ActiveCard workoutId={activeId} /> : null}

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.key}>
              <h2 className="text-muted-foreground mb-3 px-1 text-xs font-medium tracking-wide uppercase">
                {g.label}
              </h2>
              <ul className="space-y-2">
                {g.items.map((it) => (
                  <li key={`${it.kind}-${it.id}`}>
                    <HistoryCard item={it} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

function ActiveCard({ workoutId }: { workoutId: string }) {
  return (
    <Link
      href={`/workouts/${workoutId}`}
      className="bg-primary text-primary-foreground mb-6 flex items-center justify-between rounded-2xl px-5 py-4 transition-transform hover:-translate-y-px"
    >
      <div className="flex items-center gap-3">
        <div className="bg-primary-foreground/15 flex size-10 items-center justify-center rounded-full">
          <Play className="size-5 fill-current" />
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-[0.18em] uppercase opacity-70">
            Активная тренировка
          </p>
          <p className="text-base font-semibold tracking-tight">
            Продолжить
          </p>
        </div>
      </div>
      <ChevronRight className="size-5 opacity-70" aria-hidden="true" />
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="bg-card border-border space-y-4 rounded-2xl border p-8 text-center">
      <div className="bg-muted/60 text-muted-foreground mx-auto flex size-12 items-center justify-center rounded-full">
        <Activity className="size-5" />
      </div>
      <div>
        <p className="text-foreground text-base font-medium">
          Тренировок ещё нет
        </p>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          Выберите формат и запустите первую сессию — она появится здесь.
        </p>
      </div>
      <div className="mt-2">
        <Button asChild size="xl" className="w-full">
          <Link href="/create">
            <Dumbbell className="size-5" />
            Создать тренировку
          </Link>
        </Button>
      </div>
    </div>
  );
}

/** Единая история: силовые + круговые + кардио в одном списке с неяркими
 *  подписями формата (F5). Каждый формат ведёт в свой detail-роут и
 *  показывает свои метрики; общая оболочка (дата · формат · название). */
type HistoryItem =
  | {
      kind: "strength";
      id: string;
      name: string;
      startedAt: Date;
      finishedAt: Date | null;
      setCount: number;
      tonnageKg: number;
      hasAnalysis: boolean;
    }
  | {
      kind: "circuit";
      id: string;
      name: string;
      startedAt: Date;
      finishedAt: Date | null;
      totalRounds: number;
      exerciseCount: number;
    }
  | {
      kind: "cardio";
      id: string;
      name: string;
      startedAt: Date;
      finishedAt: Date | null;
      preset: CardioPresetKind;
      totalActualSec: number;
      totalPlannedSec: number;
      hrAvg: number | null;
    };

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

function buildHistory(
  strength: RecentWorkout[],
  circuits: CircuitSummary[],
  cardio: CardioSummary[],
): HistoryItem[] {
  const items: HistoryItem[] = [
    ...strength
      .filter((w) => w.status === "completed")
      .map((w): HistoryItem => ({ kind: "strength", ...w })),
    ...circuits
      .filter((c) => c.status === "completed")
      .map(
        (c): HistoryItem => ({
          kind: "circuit",
          id: c.id,
          name: c.name,
          startedAt: c.startedAt,
          finishedAt: c.finishedAt,
          totalRounds: c.totalRounds,
          exerciseCount: c.exerciseCount,
        }),
      ),
    ...cardio
      .filter((c) => c.status === "completed")
      .map(
        (c): HistoryItem => ({
          kind: "cardio",
          id: c.id,
          name: c.name,
          startedAt: c.startedAt,
          finishedAt: c.finishedAt,
          preset: c.preset,
          totalActualSec: c.totalActualSec,
          totalPlannedSec: c.totalPlannedSec,
          hrAvg: c.hrAvg,
        }),
      ),
  ];

  return items.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}

function durationMinutes(startedAt: Date, finishedAt: Date | null): number | null {
  if (!finishedAt) return null;
  return Math.max(
    1,
    Math.round((finishedAt.getTime() - startedAt.getTime()) / 60_000),
  );
}

function FormatPill({ label }: { label: string }) {
  return (
    <span className="bg-muted/60 text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
      {label}
    </span>
  );
}

function HistoryCard({ item }: { item: HistoryItem }) {
  const href = `${FORMAT_HREF[item.kind]}/${item.id}`;

  return (
    <Link
      href={href}
      className="bg-card hover:bg-accent/40 border-border block rounded-2xl border p-4 transition-colors"
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
          {item.kind === "strength" && item.hasAnalysis ? (
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

// --- helpers --- //

type WeekGroup = {
  key: string;
  label: string;
  items: HistoryItem[];
};

function groupByWeek(items: HistoryItem[]): WeekGroup[] {
  if (items.length === 0) return [];

  const now = new Date();
  const thisWeekStart = startOfWeek(now);
  const lastWeekStart = addDays(thisWeekStart, -7);

  const buckets = new Map<string, HistoryItem[]>();
  const labels = new Map<string, string>();

  for (const w of items) {
    const weekStart = startOfWeek(w.startedAt);
    const key = weekStart.toISOString().slice(0, 10);

    if (!buckets.has(key)) {
      buckets.set(key, []);
      labels.set(key, labelForWeek(weekStart, thisWeekStart, lastWeekStart));
    }
    buckets.get(key)!.push(w);
  }

  return Array.from(buckets.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, list]) => ({
      key,
      label: labels.get(key)!,
      items: list,
    }));
}

function startOfWeek(d: Date): Date {
  // ISO week — Monday start
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay(); // 0..6 (Sun..Sat)
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function labelForWeek(
  weekStart: Date,
  thisWeek: Date,
  lastWeek: Date,
): string {
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(weekStart, thisWeek)) return "Эта неделя";
  if (sameDay(weekStart, lastWeek)) return "Прошлая неделя";

  const diffDays = Math.round(
    (thisWeek.getTime() - weekStart.getTime()) / 86_400_000,
  );
  const weeksAgo = Math.round(diffDays / 7);
  if (weeksAgo < 4) return `${weeksAgo} нед. назад`;

  return weekStart.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
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
