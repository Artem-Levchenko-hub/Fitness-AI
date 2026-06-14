import {
  CheckCircle2,
  ChevronLeft,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmDeleteButton } from "@/components/app/confirm-delete-button";
import {
  TrainerResultCard,
  type TrainerResultData,
} from "@/components/trainer/TrainerResultCard";
import { Button } from "@/components/ui/button";
import { buildExerciseLinkMap } from "@/lib/ai/exercise-links";
import { resolvePastAdviceHref } from "@/lib/ai/past-advice-link";
import { requireUser } from "@/lib/auth/require-user";
import { bestEstimatedOneRepMax, totalVolume } from "@/lib/domain";
import {
  summarizePreviousSession,
  type PreviousSessionSummary,
} from "@/lib/domain/exercise/previous-session";
import {
  summarizeGoalProgress,
  type GoalProgressView,
} from "@/lib/domain/progression/goal-projection";
import { goalSeries } from "@/lib/domain/progression/goal-series";
import {
  getActiveWorkoutForUser,
  getAiAnalysisForWorkout,
  getPreviousAnalysisRef,
  type ActiveWorkout,
  type ActiveWorkoutExercise,
} from "@/lib/repos/workouts.repo";
import { getExerciseGoal } from "@/lib/repos/goals.repo";
import { exerciseSetHistory } from "@/lib/repos/stats.repo";
import { deleteWorkoutAction } from "@/server/actions/workouts";

import { ActiveWorkoutView } from "./active-workout";

export const metadata: Metadata = { title: "Тренировка" };

type Props = { params: Promise<{ id: string }> };

export default async function WorkoutPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser();
  const workout = await getActiveWorkoutForUser(user.id, id);
  if (!workout) notFound();

  if (workout.status === "completed") {
    const analysis = await getAiAnalysisForWorkout(user.id, id);
    // H13.6 — паритет «Прошлого совета»: деталь истории = своя поверхность,
    // заголовок «Прошлый совет» кликабелен идентично /workouts/[id]/trainer
    // (тот же резолв силового предшественника, исключая текущую тренировку).
    const pastAdviceHref = resolvePastAdviceHref(
      await getPreviousAnalysisRef(user.id, "strength", { workoutId: id }),
    );
    return (
      <CompletedView
        workout={workout}
        analysis={analysis}
        pastAdviceHref={pastAdviceHref}
      />
    );
  }

  // H12.1 — «Прошлый раз» в точке решения: для каждого упражнения активной
  // тренировки берём последнюю ЗАВЕРШЁННУЮ сессию того же упражнения
  // (exerciseSetHistory — тот же источник, что /exercises/[id], → строка
  // совпадает с историей). Текущая активная тренировка не completed →
  // исключена запросом. Промах истории → null (R-37: строки нет, префилл
  // падает на target).
  const previousByExerciseId = new Map<string, PreviousSessionSummary>();
  // H18.2 (под-слайс B) — активная цель упражнения → read-only трек-бар
  // «текущее→цель» ТЕМ ЖЕ компонентом GoalTrackBar под «Прошлый раз» (носитель
  // цели = точка решения; урок H4.3 — один компонент). Полную историю тянем
  // ТОЛЬКО при наличии цели; goalSeries — тот же источник, что /exercises/[id].
  const goalByExerciseId = new Map<string, GoalProgressView>();
  await Promise.all(
    workout.exercises.map(async (ex) => {
      const [latest] = await exerciseSetHistory(user.id, ex.exerciseId, 1);
      const summary = summarizePreviousSession(latest ?? null);
      if (summary) previousByExerciseId.set(ex.exerciseId, summary);

      const goal = await getExerciseGoal(user.id, ex.exerciseId);
      if (goal && (goal.kind === "weight" || goal.kind === "1rm")) {
        const history = await exerciseSetHistory(user.id, ex.exerciseId);
        goalByExerciseId.set(
          ex.exerciseId,
          summarizeGoalProgress(goalSeries(history, goal.kind), goal.targetValue),
        );
      }
    }),
  );

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

      <ActiveWorkoutView
        workout={workout}
        previousByExerciseId={previousByExerciseId}
        goalByExerciseId={goalByExerciseId}
      />

      <div className="border-border mt-8 border-t pt-5">
        <ConfirmDeleteButton
          action={deleteWorkoutAction}
          hidden={{ workoutId: workout.id }}
          title="Удалить тренировку?"
          description="Активная тренировка и все записанные подходы удалятся безвозвратно."
          triggerLabel="Удалить тренировку"
          fullWidth
        />
      </div>
    </main>
  );
}

function CompletedView({
  workout,
  analysis,
  pastAdviceHref,
}: {
  workout: ActiveWorkout;
  analysis: Awaited<ReturnType<typeof getAiAnalysisForWorkout>>;
  pastAdviceHref: string | null;
}) {
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
    ? Math.max(
        1,
        Math.round(
          (workout.finishedAt.getTime() - workout.startedAt.getTime()) /
            60_000,
        ),
      )
    : null;

  const dateLabel = workout.finishedAt
    ? workout.finishedAt.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        weekday: "long",
      })
    : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/workouts">
          <ChevronLeft className="size-4" />
          К истории
        </Link>
      </Button>

      <header className="mb-6">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          {dateLabel ?? "Завершено"}
        </p>
        <h1 className="font-serif mt-1 text-3xl font-normal tracking-tight md:text-4xl">
          {workout.name}
        </h1>
      </header>

      <section className="bg-success/5 border-success/20 mb-6 rounded-2xl border p-5">
        <div className="flex items-start gap-3">
          <div className="bg-success/15 text-success mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full">
            <CheckCircle2 className="size-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold tracking-tight">
              Тренировка завершена
            </h2>
            <ul className="text-muted-foreground tabular mt-3 grid grid-cols-3 gap-2 text-xs">
              <KPI value={String(totalSets)} label="подходов" />
              <KPI
                value={Math.round(tonnageKg).toLocaleString("ru-RU")}
                label="kg·reps"
              />
              <KPI value={durationMin?.toString() ?? "—"} label="минут" />
            </ul>
          </div>
        </div>
      </section>

      {analysis?.resultJson ? (
        // Structured-разбор (F4) — цветная карточка с per-exercise дельтами,
        // те же что на /trainer. Раньше история показывала plain markdown (G3).
        <section>
          {/* H13.4 — детали истории = своя поверхность разбора: строки
              упражнений и заголовки факторов жизни кликабельны идентично
              /workouts/[id]/trainer (карта из упражнений ЭТОЙ тренировки;
              своя/share-граница соблюдена — share/друг сюда не попадают). */}
          <TrainerResultCard
            data={analysis.resultJson as TrainerResultData}
            exerciseLinks={buildExerciseLinkMap(workout.exercises)}
            linkLifeFactors
            pastAdviceHref={pastAdviceHref}
          />
          <div className="mt-4">
            <Button asChild variant="outline" size="sm">
              <Link href={`/workouts/${workout.id}/coach`}>
                <MessageSquare className="size-4" />
                Открыть разговор
              </Link>
            </Button>
          </div>
        </section>
      ) : analysis ? (
        // Legacy-разбор без resultJson (старые cron-записи) — markdown-фолбэк.
        <AnalysisCard
          content={analysis.content}
          workoutId={workout.id}
          createdAt={analysis.createdAt}
        />
      ) : (
        <CoachCta workoutId={workout.id} />
      )}

      <section className="mt-6">
        <h2 className="font-serif mb-3 text-2xl font-normal tracking-tight">
          Что делали
        </h2>
        <ul className="space-y-3">
          {workout.exercises.map((ex) => (
            <li key={ex.id}>
              <ExerciseBlock exercise={ex} />
            </li>
          ))}
        </ul>
      </section>

      <div className="border-border mt-8 border-t pt-5">
        <ConfirmDeleteButton
          action={deleteWorkoutAction}
          hidden={{ workoutId: workout.id }}
          title="Удалить тренировку?"
          description="Тренировка, все подходы и AI-анализ удалятся безвозвратно."
          triggerLabel="Удалить тренировку"
          fullWidth
        />
      </div>
    </main>
  );
}

function KPI({ value, label }: { value: string; label: string }) {
  return (
    <li>
      <p className="text-foreground tabular text-2xl font-semibold">{value}</p>
      <p>{label}</p>
    </li>
  );
}

function ExerciseBlock({ exercise }: { exercise: ActiveWorkoutExercise }) {
  const sets = exercise.sets;
  if (sets.length === 0) {
    return (
      <div className="bg-card border-border rounded-2xl border p-4">
        <h3 className="text-sm font-semibold tracking-tight">
          {exercise.exerciseNameRu}
        </h3>
        <p className="text-muted-foreground mt-1 text-xs">
          Подходы не выполнены
        </p>
      </div>
    );
  }
  const best1rm = bestEstimatedOneRepMax(
    sets.map((s) => ({ weightKg: s.weightKg, reps: s.reps })),
  );
  return (
    <div className="bg-card border-border rounded-2xl border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-tight">
          {exercise.exerciseNameRu}
        </h3>
        {best1rm ? (
          <p className="text-muted-foreground tabular text-xs">
            1RM ≈ <span className="text-foreground font-medium">{best1rm} кг</span>
          </p>
        ) : null}
      </div>
      <ul className="tabular mt-3 space-y-1.5 text-sm">
        {sets.map((s, i) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-3 text-foreground"
          >
            <span className="text-muted-foreground inline-flex size-6 items-center justify-center rounded-md bg-muted text-[11px] font-medium">
              {i + 1}
            </span>
            <span className="flex-1 tabular">
              {formatNum(s.weightKg)} <span className="text-muted-foreground">кг</span>{" "}
              × {s.reps}{" "}
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
    </div>
  );
}

function AnalysisCard({
  content,
  workoutId,
  createdAt,
}: {
  content: string;
  workoutId: string;
  createdAt: Date;
}) {
  return (
    <section className="bg-primary/5 border-primary/20 rounded-2xl border p-5">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-full">
            <Sparkles className="size-4" />
          </div>
          <h2 className="text-sm font-semibold tracking-tight">AI-анализ</h2>
        </div>
        <p className="text-muted-foreground text-[10px] uppercase tracking-wide">
          {createdAt.toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "short",
          })}
        </p>
      </header>
      <div className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
      <div className="mt-4">
        <Button asChild variant="outline" size="sm">
          <Link href={`/workouts/${workoutId}/coach`}>
            <MessageSquare className="size-4" />
            Открыть разговор
          </Link>
        </Button>
      </div>
    </section>
  );
}

function CoachCta({ workoutId }: { workoutId: string }) {
  return (
    <section className="bg-card border-border rounded-2xl border p-5">
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
          <Sparkles className="size-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold tracking-tight">
            Разбор тренировки
          </h2>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            AI-тренер автоматически разбирает каждую завершённую тренировку
            (структурная оценка). Коуч — отдельный диалог в свободной форме.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <Button asChild size="xl" className="w-full">
          <Link href={`/workouts/${workoutId}/trainer`}>
            <Sparkles className="size-5" />
            AI-тренер
          </Link>
        </Button>
        <Button asChild size="xl" variant="outline" className="w-full">
          <Link href={`/workouts/${workoutId}/coach`}>
            <MessageSquare className="size-5" />
            Чат с коучем
          </Link>
        </Button>
      </div>
    </section>
  );
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function labelSetType(t: ActiveWorkoutExercise["sets"][number]["setType"]): string {
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
