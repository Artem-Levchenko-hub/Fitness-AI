import { AlertTriangle, ChevronLeft, Pencil, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ExerciseDemo } from "@/components/app/ExerciseDemo";
import { MuscleBadges, muscleLabel } from "@/components/app/MuscleBadges";
import { GoalTrackBar } from "@/components/progression/GoalTrackBar";
import { Button } from "@/components/ui/button";
import {
  summarizeGoalProgress,
  type GoalProgressView,
} from "@/lib/domain/progression/goal-projection";
import { getExerciseDemo } from "@/lib/domain/exercises/demos";
import { goalSeries } from "@/lib/domain/progression/goal-series";
import {
  detectStagnation,
  E1RM_STAGNATION_EPSILON_KG,
} from "@/lib/domain/progression/stagnation";
import { requireUser } from "@/lib/auth/require-user";
import { getExerciseById } from "@/lib/repos/exercises.repo";
import { getExerciseGoal } from "@/lib/repos/goals.repo";
import {
  exerciseSetHistory,
  type ExerciseSession,
} from "@/lib/repos/stats.repo";
import { deleteCustomExerciseAction } from "@/server/actions/exercises";
import {
  clearExerciseGoalAction,
  setExerciseGoalAction,
} from "@/server/actions/goals";

export const metadata: Metadata = { title: "Упражнение" };

type Props = { params: Promise<{ id: string }> };

export default async function ExerciseDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser();
  const exercise = await getExerciseById(user.id, id);
  if (!exercise) notFound();

  const history = await exerciseSetHistory(user.id, id);

  // H11.4 — застой e1RM: серия лучших рабочих 1RM по сессиям в хронологическом
  // порядке (history — новые сверху, поэтому реверс; сессии без working-сетов
  // best1rm=0 исключаем, чтобы разминочные дни не давали ложный регресс).
  // epsilon 0.5 кг поглощает float-шум формулы e1RM. Ноль нового запроса.
  const e1rmSeries = history
    .filter((s) => s.best1rm > 0)
    .map((s) => s.best1rm)
    .reverse();
  const stagnation = detectStagnation(e1rmSeries, 3, {
    epsilon: E1RM_STAGNATION_EPSILON_KG,
  });

  // H18.2 — цель упражнения + проекция темпа. Серия зависит от вида цели
  // (goalSeries — единый источник правила, тот же на «Прошлый раз» активной
  // тренировки). Нет цели → блок не рендерится (R-37).
  const goal = await getExerciseGoal(user.id, id);
  let goalView: GoalProgressView | null = null;
  if (goal && (goal.kind === "weight" || goal.kind === "1rm")) {
    goalView = summarizeGoalProgress(
      goalSeries(history, goal.kind),
      goal.targetValue,
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/exercises">
          <ChevronLeft className="size-4" />
          Каталог
        </Link>
      </Button>

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {exercise.nameRu}
          </h1>
          {stagnation.stale ? (
            <span className="bg-warning/15 text-warning inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
              <AlertTriangle className="size-3.5" />
              Застой {stagnation.streak} {pluralSessions(stagnation.streak)}
            </span>
          ) : null}
        </div>
        <p className="text-muted-foreground mt-1 text-sm">{exercise.nameEn}</p>
      </header>

      {getExerciseDemo(exercise.slug) ? (
        <div className="mb-6 flex justify-center">
          <ExerciseDemo
            slug={exercise.slug}
            alt={`Демонстрация: ${exercise.nameRu}`}
            variant="hero"
          />
        </div>
      ) : null}

      <section className="bg-card border-border mb-4 space-y-4 rounded-2xl border p-5">
        <div>
          <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            Основные мышцы
          </p>
          <MuscleBadges primary={exercise.primaryMuscles} />
        </div>

        {exercise.secondaryMuscles.length > 0 ? (
          <div>
            <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
              Вторичные мышцы
            </p>
            <div className="flex flex-wrap gap-1.5">
              {exercise.secondaryMuscles.map((k) => (
                <span
                  key={k}
                  className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-xs font-medium"
                >
                  {muscleLabel(k)}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {exercise.description ? (
          <div>
            <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
              Описание
            </p>
            <p className="text-sm leading-relaxed">{exercise.description}</p>
          </div>
        ) : null}
      </section>

      <GoalSection exerciseId={id} kind={goal?.kind ?? null} view={goalView} />

      {exercise.isCustom && exercise.ownerUserId === user.id ? (
        <div className="flex gap-2">
          <Button asChild variant="outline" className="flex-1">
            <Link href={`/exercises/${exercise.id}/edit`}>
              <Pencil className="size-4" />
              Редактировать
            </Link>
          </Button>
          <form action={deleteCustomExerciseAction} className="flex-1">
            <input type="hidden" name="exerciseId" value={exercise.id} />
            <Button
              type="submit"
              variant="outline"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive w-full"
            >
              <Trash2 className="size-4" />
              Удалить
            </Button>
          </form>
        </div>
      ) : (
        <p className="text-muted-foreground/70 text-xs">
          Системное упражнение — изменению/удалению не подлежит.
        </p>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold tracking-tight">
          История подходов
        </h2>
        {history.length === 0 ? (
          <p className="text-muted-foreground rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm">
            Пока нет выполненных подходов с этим упражнением.
          </p>
        ) : (
          <ul className="space-y-3">
            {history.map((session) => (
              <SessionCard key={session.workoutId} session={session} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

/** H18.2 — секция цели упражнения: read-only трек-бар (если цель есть) +
 *  форма постановки/обновления и снятия. Нативные формы → Server Action
 *  (без клиента, паттерн deleteCustomExerciseAction). Тапы ≥44px (R-41). */
function GoalSection({
  exerciseId,
  kind,
  view,
}: {
  exerciseId: string;
  kind: "weight" | "1rm" | "frequency" | null;
  view: GoalProgressView | null;
}) {
  const fieldLabel = "text-muted-foreground mb-1 block text-xs font-medium";
  const control =
    "border-border bg-background h-11 w-full rounded-lg border px-3 text-sm";

  return (
    <section className="bg-card border-border mt-4 space-y-4 rounded-2xl border p-5">
      {view ? <GoalTrackBar view={view} /> : null}

      <form
        action={setExerciseGoalAction}
        className="flex flex-wrap items-end gap-2"
      >
        <input type="hidden" name="exerciseId" value={exerciseId} />
        <label className="min-w-[9rem] flex-1">
          <span className={fieldLabel}>Тип цели</span>
          <select
            name="kind"
            defaultValue={kind === "1rm" ? "1rm" : "weight"}
            className={control}
          >
            <option value="weight">Рабочий вес</option>
            <option value="1rm">1ПМ (расчётный)</option>
          </select>
        </label>
        <label className="min-w-[7rem] flex-1">
          <span className={fieldLabel}>Цель, кг</span>
          <input
            name="targetValue"
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0.5"
            required
            placeholder="например, 100"
            className={control}
          />
        </label>
        <Button type="submit" className="h-11">
          {view ? "Обновить цель" : "Поставить цель"}
        </Button>
      </form>

      {view ? (
        <form action={clearExerciseGoalAction}>
          <input type="hidden" name="exerciseId" value={exerciseId} />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="text-muted-foreground -ml-2"
          >
            Убрать цель
          </Button>
        </form>
      ) : null}
    </section>
  );
}

function SessionCard({ session }: { session: ExerciseSession }) {
  return (
    <li className="bg-card border-border rounded-2xl border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <Link
          href={`/workouts/${session.workoutId}`}
          className="text-sm font-medium tracking-tight hover:underline"
        >
          {session.date.toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </Link>
        {session.best1rm > 0 ? (
          <p className="text-muted-foreground tabular text-xs">
            1RM ≈{" "}
            <span className="text-foreground font-medium">
              {Math.round(session.best1rm)} кг
            </span>
          </p>
        ) : null}
      </div>
      <ul className="tabular mt-3 space-y-1.5 text-sm">
        {session.sets.map((s, i) => (
          <li
            key={s.id}
            className="text-foreground flex items-center justify-between gap-3"
          >
            <span className="text-muted-foreground bg-muted inline-flex size-6 items-center justify-center rounded-md text-[11px] font-medium">
              {i + 1}
            </span>
            <span className="tabular flex-1">
              {formatNum(s.weightKg)}{" "}
              <span className="text-muted-foreground">кг</span> × {s.reps}{" "}
              <span className="text-muted-foreground text-xs">
                {s.myoRole
                  ? `· ${s.myoRole === "activation" ? "myo: активация" : "myo: мини"}`
                  : s.setType !== "working"
                    ? `· ${labelSetType(s.setType)}`
                    : ""}
              </span>
            </span>
            {s.rpe != null ? (
              <span className="text-muted-foreground text-xs">
                RPE {formatNum(s.rpe)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </li>
  );
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Русская плюрализация «сессия/сессии/сессий» для бейджа застоя. */
function pluralSessions(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "сессия";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "сессии";
  return "сессий";
}

function labelSetType(t: ExerciseSession["sets"][number]["setType"]): string {
  switch (t) {
    case "warmup":
      return "разминка";
    case "drop":
      return "drop-set";
    case "failure":
      return "до отказа";
    default:
      return "";
  }
}
