import {
  ArrowRight,
  ChevronRight,
  Dumbbell,
  Plus,
  Sparkles,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { NutritionTile } from "@/components/dashboard/NutritionTile";
import { ResumeBanner } from "@/components/dashboard/ResumeBanner";
import { SleepTile } from "@/components/dashboard/SleepTile";
import { TrainerTrigger } from "@/components/dashboard/TrainerTrigger";
import {
  buildHistory,
  HistoryCard,
} from "@/components/workouts/workout-history";
import { requireUser } from "@/lib/auth/require-user";
import {
  getActiveCardioId,
  listRecentCardio,
} from "@/lib/repos/cardio.repo";
import { getActiveCircuitId, listCircuits } from "@/lib/repos/circuits.repo";
import {
  getActiveWorkoutId,
  listRecentWorkouts,
  type RecentWorkout,
} from "@/lib/repos/workouts.repo";

export const metadata: Metadata = { title: "Главная" };

export default async function DashboardPage() {
  const user = await requireUser();
  const name = user.name?.split(" ")[0] ?? user.email.split("@")[0];

  const [
    recent,
    activeId,
    recentCardio,
    activeCardioId,
    recentCircuits,
    activeCircuitId,
  ] = await Promise.all([
    listRecentWorkouts(user.id, 30),
    getActiveWorkoutId(user.id),
    listRecentCardio(user.id, 10),
    getActiveCardioId(user.id),
    listCircuits(user.id, 10),
    getActiveCircuitId(user.id),
  ]);

  const completed = recent.filter((w) => w.status === "completed");
  const last = completed[0] ?? null;
  const week = sumThisWeek(completed);
  // Единый поток: «Недавние» сливает силовые + круговые + кардио (как /workouts),
  // а не показывает только силовые — иначе круговая/кардио-сессия «пропадает».
  const recentHistory = buildHistory(recent, recentCircuits, recentCardio).slice(
    0,
    3,
  );

  // Единый вход: один CTA «Начать тренировку» → /create (пикер формата) вместо
  // трёх формат-тайлов. Активные сессии любого формата — общий ResumeBanner.
  const resumes = [
    activeId
      ? { href: `/workouts/${activeId}`, label: "Активная тренировка" }
      : null,
    activeCircuitId
      ? { href: `/circuits/${activeCircuitId}`, label: "Активная круговая" }
      : null,
    activeCardioId
      ? { href: `/cardio/${activeCardioId}`, label: "Активная кардио-сессия" }
      : null,
  ].filter((r): r is { href: string; label: string } => r !== null);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <header className="mb-8">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          {greetingLabel(new Date())}
        </p>
        <h1 className="font-serif mt-1 text-4xl font-normal tracking-tight md:text-5xl">
          Привет, {name}
        </h1>
      </header>

      {resumes.length > 0 ? (
        <div className="mb-6 space-y-3">
          {resumes.map((r) => (
            <ResumeBanner key={r.href} href={r.href} label={r.label} />
          ))}
        </div>
      ) : null}

      <StartCard />

      <section className="mt-6 grid grid-cols-2 gap-3">
        <WeekCard
          workouts={week.count}
          tonnage={week.tonnage}
        />
        {last ? (
          <LastWorkoutMini workout={last} />
        ) : (
          <EmptyMini />
        )}
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-muted-foreground mb-2 px-1 text-xs font-medium tracking-wide uppercase">
          Восстановление
        </h2>
        <SleepTile userId={user.id} />
        <NutritionTile userId={user.id} />
      </section>

      <section className="mt-6">
        <TrainerTrigger lastWorkoutId={last?.id ?? null} />
      </section>

      {recentHistory.length > 0 ? (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="font-serif text-2xl font-normal tracking-tight">
              Недавние
            </h2>
            <Link
              href="/workouts"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium tracking-wide uppercase"
            >
              Все
              <ChevronRight className="size-3" />
            </Link>
          </div>
          <ul className="space-y-2">
            {recentHistory.map((it) => (
              <li key={`${it.kind}-${it.id}`}>
                <HistoryCard item={it} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function StartCard() {
  return (
    <section className="bg-card text-card-foreground border-border rounded-2xl border p-6">
      <h2 className="font-serif text-2xl font-normal tracking-tight">
        Готовы тренироваться?
      </h2>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        Один вход для всех форматов — силовая, круговая, кардио и интервалы.
      </p>

      <div className="mt-5 flex flex-col gap-3">
        <Button asChild size="xl" className="w-full">
          <Link href="/create">
            <Plus className="size-5" />
            Начать тренировку
          </Link>
        </Button>
        <Button asChild size="xl" variant="outline" className="w-full">
          <Link href="/templates">
            <Dumbbell className="size-5" />
            Мои шаблоны
          </Link>
        </Button>
      </div>
    </section>
  );
}

function WeekCard({ workouts, tonnage }: { workouts: number; tonnage: number }) {
  return (
    <div className="bg-card border-border rounded-2xl border p-4">
      <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        Эта неделя
      </p>
      <p className="font-serif tabular mt-1 text-3xl font-normal tracking-tight">
        {workouts}
      </p>
      <p className="text-muted-foreground text-xs">
        {pluralize(workouts, "тренировка", "тренировки", "тренировок")}
      </p>
      <p className="text-muted-foreground tabular mt-3 text-xs">
        Тоннаж:{" "}
        <span className="text-foreground font-medium">
          {Math.round(tonnage).toLocaleString("ru-RU")}
        </span>{" "}
        kg·reps
      </p>
    </div>
  );
}

function LastWorkoutMini({ workout }: { workout: RecentWorkout }) {
  return (
    <Link
      href={`/workouts/${workout.id}`}
      className="bg-card hover:bg-accent/40 border-border block rounded-2xl border p-4 transition-colors"
    >
      <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        Последняя
      </p>
      <p className="mt-1 truncate text-base font-semibold tracking-tight">
        {workout.name}
      </p>
      <p className="text-muted-foreground mt-0.5 text-xs">
        {workout.startedAt.toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "short",
        })}
      </p>
      <div className="text-muted-foreground tabular mt-3 flex items-center justify-between text-xs">
        <span>
          {workout.setCount} подходов
        </span>
        {workout.hasAnalysis ? (
          <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
            <Sparkles className="size-3" />
            AI
          </span>
        ) : null}
      </div>
    </Link>
  );
}

function EmptyMini() {
  return (
    <div className="bg-card border-border flex flex-col justify-between rounded-2xl border p-4">
      <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        Первая тренировка
      </p>
      <p className="text-foreground mt-2 text-sm leading-relaxed">
        Откройте каталог упражнений или создайте шаблон.
      </p>
      <Link
        href="/exercises"
        className="text-primary mt-3 inline-flex items-center gap-1 text-xs font-medium"
      >
        Каталог
        <ArrowRight className="size-3" />
      </Link>
    </div>
  );
}

// --- helpers --- //

function startOfWeek(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function sumThisWeek(items: RecentWorkout[]): { count: number; tonnage: number } {
  const from = startOfWeek(new Date()).getTime();
  let count = 0;
  let tonnage = 0;
  for (const w of items) {
    if (w.startedAt.getTime() >= from) {
      count += 1;
      tonnage += w.tonnageKg;
    }
  }
  return { count, tonnage };
}

function pluralize(
  n: number,
  one: string,
  few: string,
  many: string,
): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function greetingLabel(d: Date): string {
  const h = d.getHours();
  if (h < 5) return "Ночью";
  if (h < 12) return "Утро";
  if (h < 17) return "День";
  if (h < 23) return "Вечер";
  return "Ночь";
}
