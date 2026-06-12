import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { TrainerJobPoller } from "@/components/trainer/TrainerJobPoller";
import {
  TrainerResultCard,
  type TrainerResultData,
} from "@/components/trainer/TrainerResultCard";
import { TrainerStreamConsumer } from "@/components/trainer/TrainerStreamConsumer";
import { ShareAnalysisButton } from "@/components/trainer/ShareAnalysisButton";
import { AskTrainerPanel } from "@/components/trainer/AskTrainerPanel";
import { renderTrainerMarkdown, trainerSchema } from "@/lib/ai/trainer-parse";
import { db } from "@/db/client";
import { and, desc, eq, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { requireUser } from "@/lib/auth/require-user";
import { totalVolume } from "@/lib/domain";
import {
  getActiveWorkoutForUser,
  getLatestTrainerResult,
} from "@/lib/repos/workouts.repo";

export const metadata: Metadata = { title: "AI-тренер" };

type Props = { params: Promise<{ id: string }> };

export default async function TrainerPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser();
  const workout = await getActiveWorkoutForUser(user.id, id);
  if (!workout) notFound();

  if (workout.status === "active") {
    redirect(`/workouts/${id}`);
  }

  // 1) Уже есть сохранённый structured-разбор (cron ИЛИ стрим) — показываем
  //    сразу, без стрима/поллинга. Покрывает повторный заход после стрима.
  const savedAnalysis = await getLatestTrainerResult(user.id, id);

  // 2) Иначе — последний aiJob для этой тренировки (его создаёт finishWorkout
  //    через cron-путь). Игнорируем failed — стрим-консьюмер создаст разбор сам.
  const [latestJob] = await db
    .select()
    .from(schema.aiJobs)
    .where(
      and(
        eq(schema.aiJobs.workoutId, id),
        inArray(schema.aiJobs.status, ["pending", "running", "succeeded"]),
      ),
    )
    .orderBy(desc(schema.aiJobs.scheduledAt))
    .limit(1);

  const totalSets = workout.exercises.reduce(
    (sum, e) => sum + e.sets.length,
    0,
  );
  const tonnageKg = workout.exercises.reduce(
    (sum, e) =>
      sum +
      totalVolume(
        e.sets.map((s) => ({
          weightKg: s.weightKg,
          reps: s.reps,
          setType: s.setType,
        })),
      ),
    0,
  );
  const durationMin = workout.finishedAt
    ? Math.round(
        (workout.finishedAt.getTime() - workout.startedAt.getTime()) / 60_000,
      )
    : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/dashboard">
          <ChevronLeft className="size-4" />
          На главную
        </Link>
      </Button>

      <header className="mb-6">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          После тренировки
        </p>
        <h1 className="font-serif mt-1 text-3xl font-normal tracking-tight md:text-4xl">
          {workout.name}
        </h1>
      </header>

      <section className="bg-card border-border mb-6 rounded-2xl border p-5">
        <ul className="text-muted-foreground tabular grid grid-cols-3 gap-2 text-xs">
          <li>
            <p className="text-foreground tabular text-2xl font-semibold">
              {totalSets}
            </p>
            <p>подходов</p>
          </li>
          <li>
            <p className="text-foreground tabular text-2xl font-semibold">
              {Math.round(tonnageKg).toLocaleString("ru")}
            </p>
            <p>kg·reps</p>
          </li>
          <li>
            <p className="text-foreground tabular text-2xl font-semibold">
              {durationMin ?? "—"}
            </p>
            <p>минут</p>
          </li>
        </ul>
      </section>

      {savedAnalysis?.resultJson ? (
        <>
          <TrainerResultCard
            data={savedAnalysis.resultJson as TrainerResultData}
          />
          <ShareAnalysisButton
            analysisId={savedAnalysis.id}
            initialToken={savedAnalysis.shareToken}
          />
          <AskTrainerPanel
            workoutId={id}
            analysisMarkdown={analysisToMarkdown(savedAnalysis.resultJson)}
          />
        </>
      ) : latestJob ? (
        // cron уже обрабатывает (или succeeded-legacy) — поллим как fallback.
        <TrainerJobPoller jobId={latestJob.id} />
      ) : (
        // Свежий on_demand — генерируем live прямо в запросе (F8-B run-2).
        <TrainerStreamConsumer workoutId={id} />
      )}

      <p className="text-muted-foreground/70 mt-6 px-1 text-xs">
        Тренер учитывает данные о сне и КБЖУ за последние 7 дней. Если не
        заполнены — он подскажет, что записать для более точной оценки.
      </p>
    </main>
  );
}

/** Текст разбора для follow-up («Спросить тренера»). Fail-soft (R-10): если
 *  resultJson не проходит схему (legacy/битый) — пустая строка, панель всё
 *  равно работает, опираясь на workout-контекст коуч-route. */
function analysisToMarkdown(resultJson: unknown): string {
  const parsed = trainerSchema.safeParse(resultJson);
  return parsed.success ? renderTrainerMarkdown(parsed.data) : "";
}

