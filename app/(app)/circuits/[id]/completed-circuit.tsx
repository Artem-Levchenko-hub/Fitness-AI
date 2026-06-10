import { CheckCircle2, Loader2, Sparkles } from "lucide-react";

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

      <AnalysisCard analysis={analysis} jobStatus={jobStatus} />

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
}: {
  analysis: { content: string; resultJson: unknown } | null;
  jobStatus: "pending" | "running" | "succeeded" | "failed" | null;
}) {
  if (analysis) {
    // Structured-разбор (F4) — цветная карточка с оценкой/аспектами, как в
    // силовой истории (G3). Раньше круговая показывала plain markdown даже при
    // готовом resultJson (G3-followup). safeParse страхует legacy-записи без
    // resultJson → markdown-фолбэк.
    const parsed = trainerSchema.safeParse(analysis.resultJson);
    if (parsed.success) {
      return <TrainerResultCard data={parsed.data as TrainerResultData} />;
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
  if (jobStatus === "pending" || jobStatus === "running") {
    return (
      <section className="bg-card border-border rounded-2xl border p-5 text-sm">
        <div className="flex items-center gap-2">
          <Loader2 className="text-muted-foreground size-4 animate-spin" />
          <p className="text-muted-foreground">
            Тренер разбирает круговую… обнови страницу через 30-60 сек.
          </p>
        </div>
      </section>
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
