import { CheckCircle2, Sparkles, Wand2 } from "lucide-react";

import { TrainerJobPoller } from "@/components/trainer/TrainerJobPoller";
import {
  TrainerResultCard,
  type TrainerResultData,
} from "@/components/trainer/TrainerResultCard";
import type { CircuitRoundLog, CircuitWorkout } from "@/db/schema";
import { trainerSchema } from "@/lib/ai/trainer-structured";
import type { CircuitExerciseWithName } from "@/lib/repos/circuits.repo";

/** Сводка по завершённой/прерванной круговой + AI-анализ (если уже готов). */
export function CompletedCircuit({
  workout,
  exercises,
  logs,
  analysis,
  jobStatus,
  jobId,
  pastAdviceHref,
  templateAdapted,
}: {
  workout: CircuitWorkout;
  exercises: CircuitExerciseWithName[];
  logs: CircuitRoundLog[];
  analysis: {
    id: string;
    content: string;
    resultJson: unknown;
    createdAt: Date;
  } | null;
  jobStatus: "pending" | "running" | "succeeded" | "failed" | null;
  /** H16.3 — id AI-задачи круговой для клиентского поллера лоадера ожидания. */
  jobId: string | null;
  /** H13.6 — ссылка на прошлый разбор круговой (own-view); null → статика. */
  pastAdviceHref?: string | null;
  /** Тренер обновил шаблон-источник по этой круговой (после анализа) → баннер. */
  templateAdapted?: boolean;
}) {
  const isCancelled = workout.status === "cancelled";
  const totalSlots = workout.totalRounds * exercises.length;
  const completedLogs = logs.filter((l) => !l.skipped);
  const totalDurationSec = logs.reduce(
    (s, l) => s + (l.actualDurationSec ?? 0),
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
    : Math.round(totalDurationSec / 60);

  // Группируем логи по упражнению.
  const logsByExercise = new Map<string, CircuitRoundLog[]>();
  for (const l of logs) {
    const arr = logsByExercise.get(l.circuitExerciseId) ?? [];
    arr.push(l);
    logsByExercise.set(l.circuitExerciseId, arr);
  }

  return (
    <div className="space-y-5">
      <section
        className={
          isCancelled
            ? "bg-warning/5 border-warning/30 rounded-2xl border p-5"
            : "bg-success/5 border-success/20 rounded-2xl border p-5"
        }
      >
        <div className="flex items-start gap-3">
          <div
            className={
              isCancelled
                ? "bg-warning/15 text-warning mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full"
                : "bg-success/15 text-success mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full"
            }
          >
            <CheckCircle2 className="size-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold tracking-tight">
              {isCancelled ? "Сессия прервана" : "Круговая завершена"}
            </h2>
            <ul className="text-muted-foreground tabular mt-3 grid grid-cols-3 gap-2 text-xs">
              <li>
                <p className="text-foreground tabular text-2xl font-semibold">
                  {completedLogs.length}
                </p>
                <p>из {totalSlots} слотов</p>
              </li>
              <li>
                <p className="text-foreground tabular text-2xl font-semibold">
                  {workout.totalRounds}
                </p>
                <p>кругов план</p>
              </li>
              <li>
                <p className="text-foreground tabular text-2xl font-semibold">
                  {durationMin}
                </p>
                <p>минут</p>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <AnalysisCard
        analysis={analysis}
        jobStatus={jobStatus}
        jobId={jobId}
        circuitWorkoutId={workout.id}
        pastAdviceHref={pastAdviceHref}
      />

      {templateAdapted ? (
        <section className="border-primary/30 bg-primary/5 rounded-2xl border p-4">
          <div className="flex items-start gap-3">
            <div className="bg-primary/15 text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
              <Wand2 className="size-4" aria-hidden="true" />
            </div>
            <div className="text-sm">
              <p className="font-semibold">Тренер обновил твой шаблон</p>
              <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                Повторы, отдых и число кругов подогнаны под то, как прошла
                тренировка. В следующий раз просто стартуй этот шаблон — он уже
                под тебя.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="bg-card border-border rounded-2xl border p-4">
        <h3 className="mb-3 text-sm font-semibold tracking-tight">
          Упражнения
        </h3>
        <ul className="space-y-3 text-sm">
          {exercises.map((ex, i) => {
            const xs = (logsByExercise.get(ex.id) ?? []).slice().sort(
              (a, b) => a.roundNumber - b.roundNumber,
            );
            return (
              <li key={ex.id} className="border-border border-b last:border-b-0 pb-3 last:pb-0">
                <p className="font-medium">
                  {i + 1}. {ex.exerciseNameRu}{" "}
                  <span className="text-muted-foreground text-xs font-normal">
                    · {ex.kind === "reps" ? `план ${ex.targetReps ?? "?"} повт.` : `план ${ex.targetDurationSec ?? "?"} сек`}
                    {ex.targetWeightKg != null ? ` · ${ex.targetWeightKg} кг` : ""}
                  </span>
                </p>
                {xs.length === 0 ? (
                  <p className="text-muted-foreground mt-1 text-xs">— нет логов</p>
                ) : (
                  <ul className="tabular text-muted-foreground mt-1 space-y-0.5 text-xs">
                    {xs.map((l) => (
                      <li key={l.id}>
                        Круг {l.roundNumber}:{" "}
                        {l.skipped ? (
                          <span className="text-warning">пропущен</span>
                        ) : (
                          <span className="text-foreground">
                            {ex.kind === "reps"
                              ? `${l.actualReps ?? "—"} повт.`
                              : `${l.actualDurationSec ?? "—"} сек`}
                            {l.actualWeightKg != null
                              ? ` × ${l.actualWeightKg} кг`
                              : ""}
                            {l.rpe != null ? ` @${l.rpe}` : ""}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {workout.notes ? (
        <section className="bg-card border-border rounded-2xl border p-4 text-sm">
          <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
            Заметка
          </p>
          <p className="mt-1 whitespace-pre-wrap">{workout.notes}</p>
        </section>
      ) : null}
    </div>
  );
}

function AnalysisCard({
  analysis,
  jobStatus,
  jobId,
  circuitWorkoutId,
  pastAdviceHref,
}: {
  analysis: { content: string; resultJson: unknown } | null;
  jobStatus: "pending" | "running" | "succeeded" | "failed" | null;
  jobId: string | null;
  circuitWorkoutId: string;
  pastAdviceHref?: string | null;
}) {
  if (analysis) {
    // Structured-разбор (F4) — цветная карточка с оценкой/аспектами, как в
    // силовой истории (G3). Раньше круговая показывала plain markdown даже при
    // готовом resultJson (G3-followup). safeParse страхует legacy-записи без
    // resultJson → markdown-фолбэк.
    const parsed = trainerSchema.safeParse(analysis.resultJson);
    if (parsed.success) {
      // H13.4 — на своём разборе круговой заголовки учтённых факторов жизни
      // кликабельны (recovery → /sleep, nutrition → /nutrition): circuit-контекст
      // подаёт сон+КБЖУ (context-builder, circuit_post_workout), граница
      // «score null → статика» (R-37) держится в resolveLifeFactorHref.
      // exerciseComparisons у круговой всегда [] (prompts.ts:78 «пусто если не
      // силовая») → строк-ссылок упражнений нет, linkExercises не нужен (R-05).
      // own-data (getCircuitForUser фильтрует userId); share /a/[token] статика.
      return (
        <TrainerResultCard
          data={parsed.data as TrainerResultData}
          linkLifeFactors
          pastAdviceHref={pastAdviceHref}
        />
      );
    }
    return (
      <section className="bg-card border-border rounded-2xl border p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="text-primary size-4" />
          <h3 className="text-sm font-semibold tracking-tight">Разбор тренера</h3>
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
          {analysis.content}
        </div>
      </section>
    );
  }
  if ((jobStatus === "pending" || jobStatus === "running") && jobId) {
    // H16.3 — де-фриз: вместо статичного «обнови страницу» — общий носитель
    // ожидания (живые стадии + книжные факты круговой) и клиентский поллер
    // /api/ai/jobs/[id], который сам подменит лоадер готовым разбором (без
    // ручного refresh). linkLifeFactors + pastAdviceHref — паритет со
    // server-путём готового разбора выше (столп 4).
    return (
      <TrainerJobPoller
        jobId={jobId}
        circuitWorkoutId={circuitWorkoutId}
        linkLifeFactors
        pastAdviceHref={pastAdviceHref}
      />
    );
  }
  if (jobStatus === "failed") {
    return (
      <section className="bg-destructive/5 border-destructive/30 rounded-2xl border p-5 text-sm">
        <p className="text-destructive">
          Разбор тренера не удался. Попробуем при следующем заходе.
        </p>
      </section>
    );
  }
  return null;
}
