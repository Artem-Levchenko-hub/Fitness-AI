import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { NewProgramSources } from "@/components/programs/NewProgramSources";
import type { HistoryWorkoutOption } from "@/components/programs/PlanFromHistoryBuilder";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { listTemplates } from "@/lib/repos/templates.repo";
import { listRecentWorkouts } from "@/lib/repos/workouts.repo";

export const metadata: Metadata = { title: "Новый план" };

/** Собрать тренировочный план: ИЗ ИСТОРИИ (завершённые тренировки → дни, точная
 *  передача выполненного) ИЛИ из готовых шаблонов. Атлет, тренирующийся по факту
 *  без шаблонов, собирает план прямо из того, что уже делал. */
export default async function NewProgramPage() {
  const user = await requireUser();
  const [templates, recent] = await Promise.all([
    listTemplates(user.id),
    listRecentWorkouts(user.id, 40),
  ]);

  const templateOptions = templates.map((t) => ({
    id: t.id,
    name: t.name,
    exerciseCount: t.exerciseCount,
  }));

  // Завершённые силовые с рабочими подходами — кандидаты в дни плана.
  const workoutOptions: HistoryWorkoutOption[] = recent
    .filter((w) => w.status === "completed" && w.setCount > 0)
    .slice(0, 20)
    .map((w) => ({
      id: w.id,
      name: w.name,
      setCount: w.setCount,
      dateLabel: (w.finishedAt ?? w.startedAt).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "short",
      }),
    }));

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/programs">
          <ChevronLeft className="size-4" />
          Мои планы
        </Link>
      </Button>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Собрать план
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Из истории тренировок или из готовых шаблонов — тренер будет вести план
          и подгонять каждый день под тебя.
        </p>
      </header>

      <NewProgramSources templates={templateOptions} workouts={workoutOptions} />
    </main>
  );
}
