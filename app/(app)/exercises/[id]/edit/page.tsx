import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import * as schema from "@/db/schema";
import { requireUser } from "@/lib/auth/require-user";
import { getExerciseById } from "@/lib/repos/exercises.repo";
import { updateCustomExerciseAction } from "@/server/actions/exercises";

import { ExerciseForm } from "../../exercise-form";

export const metadata: Metadata = { title: "Редактировать упражнение" };

type Props = { params: Promise<{ id: string }> };

export default async function EditExercisePage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser();
  const exercise = await getExerciseById(user.id, id);
  if (!exercise) notFound();
  if (!exercise.isCustom || exercise.ownerUserId !== user.id) {
    redirect(`/exercises/${id}`);
  }

  const action = updateCustomExerciseAction.bind(null, id);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href={`/exercises/${id}`}>
          <ChevronLeft className="size-4" />
          К упражнению
        </Link>
      </Button>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Редактировать упражнение
        </h1>
      </header>

      <ExerciseForm
        muscleKeys={schema.muscleGroupKey.enumValues}
        initial={{
          nameRu: exercise.nameRu,
          nameEn: exercise.nameEn,
          description: exercise.description,
          primary: exercise.primaryMuscles,
          secondary: exercise.secondaryMuscles,
        }}
        action={action}
        submitLabel="Сохранить"
      />
    </main>
  );
}
