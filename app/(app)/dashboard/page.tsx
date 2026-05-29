import {
  ArrowRight,
  ChevronRight,
  Dumbbell,
  Play,
  Plus,
  Sparkles,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { CircuitTile } from "@/components/dashboard/CircuitTile";
import { NutritionTile } from "@/components/dashboard/NutritionTile";
import { SleepTile } from "@/components/dashboard/SleepTile";
import { TrainerTrigger } from "@/components/dashboard/TrainerTrigger";
import { requireUser } from "@/lib/auth/require-user";
import {
  getActiveCardioId,
  listRecentCardio,
} from "@/lib/repos/cardio.repo";
import {
  getActiveWorkoutId,
  listRecentWorkouts,
  type RecentWorkout,
} from "@/lib/repos/workouts.repo";

export const metadata: Metadata = { title: "Главная" };

export default async function DashboardPage() {
  const user = await requireUser();
  const name = user.name?.split(" ")[0] ?? user.email.split("@")[0];

  const [recent, activeId, recentCardio, activeCardioId] = await Promise.all([
    listRecentWorkouts(user.id, 30),
    getActiveWorkoutId(user.id),
    listRecentCardio(user.id, 5),
    getActiveCardioId(user.id),
  ]);

  const completed = recent.filter((w) => w.status === "completed");
  const last = completed[0] ?? null;
  const week = sumThisWeek(completed);
  const lastCardio = recentCardio.find((c) => c.status === "completed") ?? null;

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

      {activeId ? <ResumeCard workoutId={activeId} /> : <StartCard />}

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

      <section className="mt-6">
        <CardioTile activeId={activeCardioId} lastName={lastCardio?.name ?? null} lastDate={lastCardio?.startedAt ?? null} />
      </section>

      <section className="mt-3">
        <CircuitTile userId={user.id} />
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

      {completed.length > 0 ? (
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
            {completed.slice(0, 3).map((w) => (
              <li key={w.id}>
                <RecentRow workout={w} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function ResumeCard({ workoutId }: { workoutId: string }) {
  return (
    <Link
      href={`/workouts/${workoutId}`}
      className="bg-primary text-primary-foreground flex items-center justify-between rounded-2xl px-6 py-5 transition-transform hover:-translate-y-px"
    >
      <div className="flex items-center gap-4">
        <div className="bg-primary-foreground/15 flex size-12 items-center justify-center rounded-full">
          <Play className="size-5 fill-current" />
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-[0.18em] uppercase opacity-70">
            Активная тренировка
          </p>
          <p className="font-serif mt-0.5 text-xl font-normal tracking-tight">
            Продолжить
          </p>
        </div>
      </div>
      <ChevronRight className="size-5 opacity-70" aria-hidden="true" />
    </Link>
  );
}

function StartCard() {
  return (
    <section className="bg-card text-card-foreground border-border rounded-2xl border p-6">
      <h2 className="font-serif text-2xl font-normal tracking-tight">
        Готовы тренироваться?
      </h2>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        Откройте шаблон и запустите сессию одним касанием. Или создайте новый.
      </p>

      <div className="mt-5 flex flex-col gap-3">
        <Button asChild size="xl" className="w-full">
          <Link href="/templates">
            <Dumbbell className="size-5" />
            Мои шаблоны
          </Link>
        </Button>
        <Button asChild size="xl" variant="outline" className="w-full">
          <Link href="/templates/new">
            <Plus className="size-5" />
            Новый шаблон
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

function CardioTile({
  activeId,
  lastName,
  lastDate,
}: {
  activeId: string | null;
  lastName: string | null;
  lastDate: Date | null;
}) {
  if (activeId) {
    return (
      <Link
        href={`/cardio/${activeId}`}
        className="bg-primary text-primary-foreground flex items-center justify-between rounded-2xl px-5 py-4 transition-transform hover:-translate-y-px"
      >
        <div className="flex items-center gap-3">
          <div className="bg-primary-foreground/15 flex size-10 items-center justify-center rounded-full">
            <Zap className="size-5" />
          </div>
          <div>
            <p className="text-[10px] font-medium tracking-[0.18em] uppercase opacity-70">
              Активная кардио-сессия
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

  return (
    <Link
      href="/cardio/new"
      className="bg-card hover:bg-accent/40 border-border flex items-center justify-between rounded-2xl border px-5 py-4 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full">
          <Zap className="size-5" />
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-[0.18em] uppercase opacity-70">
            Кардио · HIIT
          </p>
          <p className="text-base font-semibold tracking-tight">
            {lastName && lastDate
              ? `Последнее: ${lastName} · ${lastDate.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}`
              : "Начать сессию"}
          </p>
        </div>
      </div>
      <ChevronRight className="text-muted-foreground size-5" aria-hidden="true" />
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

function RecentRow({ workout }: { workout: RecentWorkout }) {
  return (
    <Link
      href={`/workouts/${workout.id}`}
      className="bg-card hover:bg-accent/40 border-border flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold tracking-tight">
          {workout.name}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {workout.startedAt.toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "short",
            weekday: "short",
          })}
          {" · "}
          {workout.setCount} подходов
        </p>
      </div>
      {workout.hasAnalysis ? (
        <Sparkles className="text-primary size-4" aria-label="есть AI-анализ" />
      ) : null}
      <ChevronRight className="text-muted-foreground size-4" />
    </Link>
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
