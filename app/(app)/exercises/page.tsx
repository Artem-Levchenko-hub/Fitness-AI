import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import * as schema from "@/db/schema";
import { listExercises } from "@/lib/repos/exercises.repo";

import { ExercisesExplorer } from "./exercises-explorer";

export const metadata: Metadata = { title: "Упражнения" };

export default async function ExercisesPage() {
  const user = await requireUser();
  const [exercises] = await Promise.all([listExercises(user.id)]);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <header className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-normal tracking-tight md:text-4xl">
          Упражнения
        </h1>
        <Button asChild size="lg" variant="outline">
          <Link href="/exercises/new">
            <Plus className="size-4" />
            Своё
          </Link>
        </Button>
      </header>

      <ExercisesExplorer
        exercises={exercises}
        muscleKeys={schema.muscleGroupKey.enumValues}
      />
    </main>
  );
}
