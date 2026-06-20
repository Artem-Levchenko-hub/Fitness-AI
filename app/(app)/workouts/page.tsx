import { Activity, Dumbbell } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SwipeableHistoryCard } from "@/components/workouts/swipeable-history-card";
import {
  buildHistory,
  type HistoryItem,
} from "@/components/workouts/workout-history";
import { requireUser } from "@/lib/auth/require-user";
import { addDaysIso, isoWeekStartIso } from "@/lib/datetime/iso-week";
import { getUserProfile } from "@/lib/repos/body.repo";
import { listRecentCardio } from "@/lib/repos/cardio.repo";
import { listCircuits } from "@/lib/repos/circuits.repo";
import { listRecentWorkouts } from "@/lib/repos/workouts.repo";

export const metadata: Metadata = { title: "Тренировки" };

export default async function WorkoutsPage() {
  const user = await requireUser();
  const [strength, circuits, cardio, profile] = await Promise.all([
    listRecentWorkouts(user.id, 60),
    listCircuits(user.id, 60),
    listRecentCardio(user.id, 60),
    getUserProfile(user.id),
  ]);

  // Группировка истории по неделям — в TZ юзера, иначе тренировка у границы
  // воскресенье↔понедельник попадает не в ту неделю (см. lib/datetime/iso-week).
  const tz = profile?.timezone ?? "Europe/Moscow";
  const items = buildHistory(strength, circuits, cardio);
  const groups = groupByWeek(items, tz);

  // Возобновление активной сессии — теперь ГЛОБАЛЬНАЯ полоса (GlobalResumeBar
  // в (app)/layout, H12.4), видна с любого экрана; page-level ResumeBanner убран.

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
                    <SwipeableHistoryCard item={it} />
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

function groupByWeek(items: HistoryItem[], tz: string): WeekGroup[] {
  if (items.length === 0) return [];

  // Все границы недели считаем в TZ юзера через "YYYY-MM-DD"-ключи понедельников.
  const thisWeekKey = isoWeekStartIso(new Date(), tz);
  const lastWeekKey = addDaysIso(thisWeekKey, -7);

  const buckets = new Map<string, HistoryItem[]>();
  const labels = new Map<string, string>();

  for (const w of items) {
    const key = isoWeekStartIso(w.startedAt, tz);

    if (!buckets.has(key)) {
      buckets.set(key, []);
      labels.set(key, labelForWeek(key, thisWeekKey, lastWeekKey));
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

function labelForWeek(
  weekKey: string,
  thisWeekKey: string,
  lastWeekKey: string,
): string {
  if (weekKey === thisWeekKey) return "Эта неделя";
  if (weekKey === lastWeekKey) return "Прошлая неделя";

  const diffDays = Math.round(
    (Date.parse(`${thisWeekKey}T12:00:00Z`) -
      Date.parse(`${weekKey}T12:00:00Z`)) /
      86_400_000,
  );
  const weeksAgo = Math.round(diffDays / 7);
  if (weeksAgo < 4) return `${weeksAgo} нед. назад`;

  // Понедельник недели как дата — формат в UTC, чтобы совпадал с ключом
  // независимо от серверной TZ.
  return new Date(`${weekKey}T12:00:00Z`).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}
