import { ChevronLeft, ChevronRight, Wand2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  TrainerResultCard,
  type TrainerResultData,
} from "@/components/trainer/TrainerResultCard";
import { TrainerStreamConsumer } from "@/components/trainer/TrainerStreamConsumer";
import { ShareAnalysisButton } from "@/components/trainer/ShareAnalysisButton";
import { AskTrainerPanel } from "@/components/trainer/AskTrainerPanel";
import { buildExerciseLinkMap } from "@/lib/ai/exercise-links";
import { resolvePastAdviceHref } from "@/lib/ai/past-advice-link";
import { renderTrainerMarkdown, trainerSchema } from "@/lib/ai/trainer-parse";
import { requireUser } from "@/lib/auth/require-user";
import { totalVolume } from "@/lib/domain";
import { getAdaptedTemplateForWorkout } from "@/lib/repos/templates.repo";
import {
  getActiveWorkoutForUser,
  getLatestTrainerResult,
  getPreviousAnalysisRef,
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

  // Уже есть сохранённый structured-разбор (живой стрим ИЛИ отложенный cron-job)
  // — показываем сразу. Иначе — живой стрим прямо в запросе: пользователь
  // СМОТРИТ, как тренер пишет разбор в реальном времени (H-LIVE). Отложенный
  // safety-net job (+90с, finishWorkoutCore) догенерит, только если стрим не
  // отработал — и идемпотентно пропустится, если стрим уже сохранил разбор.
  const savedAnalysis = await getLatestTrainerResult(user.id, id);

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

  // H13.5 — заголовок «Прошлый совет» ведёт в сам тот прошлый разбор: свежайший
  // предшественник того же (силового) формата, исключая текущую тренировку — та
  // же запись, что кормит «Память тренера». Своя сессия (own-view); share/друг
  // эту страницу не рендерят. Нет предшественника (первый разбор) → null → статика.
  const pastAdviceHref = resolvePastAdviceHref(
    await getPreviousAnalysisRef(user.id, "strength", { workoutId: id }),
  );

  // CTA «шаблон обновлён → открыть»: шаблон, который тренер подкрутил по ЭТОЙ
  // тренировке (если она была по шаблону). null — ad-hoc / opt-out / не
  // адаптирован. Замыкает петлю: из разбора сразу к скорректированному шаблону.
  const adaptedTemplate = await getAdaptedTemplateForWorkout(user.id, id);

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

      {adaptedTemplate ? (
        <Link
          href={`/templates/${adaptedTemplate.id}`}
          className="border-primary/30 bg-primary/5 hover:bg-primary/10 mb-6 flex items-center gap-3 rounded-2xl border p-4 transition-colors"
        >
          <span className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
            <Wand2 className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
              Шаблон обновлён тренером
            </span>
            <span className="text-muted-foreground block truncate text-xs">
              «{adaptedTemplate.name}» — веса и повторы подогнаны под эту
              тренировку
            </span>
          </span>
          <span className="text-primary inline-flex shrink-0 items-center gap-0.5 text-sm font-medium">
            Открыть
            <ChevronRight className="size-4" aria-hidden="true" />
          </span>
        </Link>
      ) : null}

      {savedAnalysis?.resultJson ? (
        <>
          <TrainerResultCard
            data={savedAnalysis.resultJson as TrainerResultData}
            exerciseLinks={buildExerciseLinkMap(workout.exercises)}
            linkLifeFactors
            pastAdviceHref={pastAdviceHref}
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
      ) : (
        // Живой стрим: тренер пишет разбор на глазах (H-LIVE).
        <TrainerStreamConsumer
          workoutId={id}
          exerciseLinks={buildExerciseLinkMap(workout.exercises)}
          linkLifeFactors
          pastAdviceHref={pastAdviceHref}
        />
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

