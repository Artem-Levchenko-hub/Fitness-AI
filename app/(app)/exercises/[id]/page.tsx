import { ChevronLeft, Pencil, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MuscleBadges, muscleLabel } from "@/components/app/MuscleBadges";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { getExerciseById } from "@/lib/repos/exercises.repo";
import { deleteCustomExerciseAction } from "@/server/actions/exercises";

export const metadata: Metadata = { title: "Упражнение" };

type Props = { params: Promise<{ id: string }> };

export default async function ExerciseDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser();
  const exercise = await getExerciseById(user.id, id);
  if (!exercise) notFound();

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

      <p className="text-muted-foreground/60 mt-8 text-xs">
        История подходов и заметки появятся в Phase 3 и 4.
      </p>
    </main>
  );
}
