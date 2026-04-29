import { CheckCircle2, ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { getActiveWorkoutForUser } from "@/lib/repos/workouts.repo";

import { ActiveWorkoutView } from "./active-workout";

export const metadata: Metadata = { title: "Тренировка" };

type Props = { params: Promise<{ id: string }> };

export default async function WorkoutPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser();
  const workout = await getActiveWorkoutForUser(user.id, id);
  if (!workout) notFound();

  if (workout.status === "completed") {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
          <Link href="/dashboard">
            <ChevronLeft className="size-4" />
            На главную
          </Link>
        </Button>

        <div className="bg-success/5 border-success/20 rounded-2xl border p-6 text-center">
          <div className="bg-success/15 text-success mx-auto mb-3 flex size-12 items-center justify-center rounded-full">
            <CheckCircle2 className="size-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            {workout.name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Тренировка завершена
          </p>
        </div>

        <p className="text-muted-foreground/70 mt-6 px-1 text-xs">
          AI-анализ результатов появится в Phase 5.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/dashboard">
          <ChevronLeft className="size-4" />
          На главную
        </Link>
      </Button>

      <header className="mb-6">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Активная тренировка
        </p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {workout.name}
        </h1>
      </header>

      <ActiveWorkoutView workout={workout} />
    </main>
  );
}
