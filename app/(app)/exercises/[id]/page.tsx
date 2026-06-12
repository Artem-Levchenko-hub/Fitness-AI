import { ChevronLeft, Pencil, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MuscleBadges, muscleLabel } from "@/components/app/MuscleBadges";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { getExerciseById } from "@/lib/repos/exercises.repo";
import {
  exerciseSetHistory,
  type ExerciseSession,
} from "@/lib/repos/stats.repo";
import { deleteCustomExerciseAction } from "@/server/actions/exercises";

export const metadata: Metadata = { title: "Упражнение" };

type Props = { params: Promise<{ id: string }> };

export default async function ExerciseDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser();
  const exercise = await getExerciseById(user.id, id);
  if (!exercise) notFound();

  const history = await exerciseSetHistory(user.id, id);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/exercises">
          <ChevronLeft className="size-4" />
          Каталог
        </Link>
      </Button>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {exercise.nameRu}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">{exercise.nameEn}</p>
      </header>

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
                {s.setType !== "working" ? `· ${labelSetType(s.setType)}` : ""}
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
