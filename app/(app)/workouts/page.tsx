import { Activity, Dumbbell } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { buildResumes } from "@/components/dashboard/active-resumes";
import { ResumeBanner } from "@/components/dashboard/ResumeBanner";
import { Button } from "@/components/ui/button";
import {
  buildHistory,
  HistoryCard,
  type HistoryItem,
} from "@/components/workouts/workout-history";
import { requireUser } from "@/lib/auth/require-user";
import { getActiveCardioId, listRecentCardio } from "@/lib/repos/cardio.repo";
import { getActiveCircuitId, listCircuits } from "@/lib/repos/circuits.repo";
import {
  getActiveWorkoutId,
  listRecentWorkouts,
} from "@/lib/repos/workouts.repo";

export const metadata: Metadata = { title: "Тренировки" };

export default async function WorkoutsPage() {
  const user = await requireUser();
  const [
    strength,
    circuits,
    cardio,
    activeId,
    activeCircuitId,
    activeCardioId,
  ] = await Promise.all([
    listRecentWorkouts(user.id, 60),
    listCircuits(user.id, 60),
    listRecentCardio(user.id, 60),
    getActiveWorkoutId(user.id),
    getActiveCircuitId(user.id),
    getActiveCardioId(user.id),
  ]);

  const items = buildHistory(strength, circuits, cardio);
  const groups = groupByWeek(items);

  // Единый поток: активная сессия любого формата (силовая/круговая/кардио) —
  // один общий ResumeBanner, как на дашборде. /workouts — единственный экран
  // истории; отдельных вкладок /circuits·/cardio больше нет (редирект сюда).
  const resumes = buildResumes({ activeId, activeCircuitId, activeCardioId });

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

      {resumes.length > 0 ? (
        <div className="mb-6 space-y-3">
          {resumes.map((r) => (
            <ResumeBanner
              key={r.href}
              href={r.href}
              label={r.label}
              cancel={r.cancel}
            />
          ))}
        </div>
      ) : null}

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
