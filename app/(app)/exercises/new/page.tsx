import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import * as schema from "@/db/schema";
import { createCustomExerciseAction } from "@/server/actions/exercises";

import { ExerciseForm } from "../exercise-form";

export const metadata: Metadata = { title: "Новое упражнение" };

export default function NewExercisePage() {
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
          Новое упражнение
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Будет видно только вам и поможет в трекинге, если стандартного нет.
        </p>
      </header>

      <ExerciseForm
        muscleKeys={schema.muscleGroupKey.enumValues}
        action={createCustomExerciseAction}
        submitLabel="Создать упражнение"
      />
    </main>
  );
}
