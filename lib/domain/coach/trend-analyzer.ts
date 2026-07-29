import type { SetScheme } from "@/lib/domain/workouts/myo-reps";

export const MIN_COACH_SESSIONS = 10;

export type TrendSet = {
  weightKg: number | null;
  reps: number;
  rpe: number | null;
  restSeconds: number | null;
  setType: string;
  myoRole?: "activation" | "mini" | null;
};

export type TrendExercise = {
  exerciseId: string;
  sets: TrendSet[];
};

export type TrendSession = {
  id: string;
  startedAt: Date;
  exercises: TrendExercise[];
  feeling: "easy" | "normal" | "hard" | null;
};

export type TrendTemplateItem = {
  exerciseId: string;
  position: number;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  targetWeightKg: number | null;
  targetRestSeconds: number;
  setScheme?: SetScheme;
  myoMiniSets?: number;
  myoRepsPercent?: number;
  myoRestSeconds?: number;
  myoFirstRestSeconds?: number;
  notes?: string | null;
};

export type TrendLifeFactors = {
  sleepHours: number[];
  sleepQuality: number[];
  nutritionDays: number;
  averageCalories: number | null;
};

export type TrendAnalysis = {
  eligible: boolean;
  relevantSessionCount: number;
  confidence: number;
  overloadRisk: boolean;
  requiresConfirmation: boolean;
  summary: string;
  rationale: string;
  items: TrendTemplateItem[];
};

type ExerciseMetrics = {
  occurrenceCount: number;
  latestTopWeight: number | null;
  latestTopReps: number | null;
  recentAverageRpe: number | null;
  recentAverageRest: number | null;
  volumeChangePercent: number | null;
};

export function analyzeTemplateTrends(input: {
  current: TrendTemplateItem[];
  sessions: TrendSession[];
  life: TrendLifeFactors;
}): TrendAnalysis {
  const sessions = [...input.sessions]
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, MIN_COACH_SESSIONS);
  if (sessions.length < MIN_COACH_SESSIONS) {
    return {
      eligible: false,
      relevantSessionCount: sessions.length,
      confidence: 0,
      overloadRisk: false,
      requiresConfirmation: false,
      summary: `Собираю историю: ${sessions.length}/${MIN_COACH_SESSIONS}`,
      rationale:
        "До десяти сопоставимых тренировок автоматические изменения не выполняются.",
      items: input.current,
    };
  }

  const hardRecent = sessions.slice(0, 3).filter((s) => s.feeling === "hard").length;
  const sleepAverage = average(input.life.sleepHours);
  const lowSleep =
    input.life.sleepHours.length >= 3 &&
    sleepAverage != null &&
    sleepAverage < 6;
  const metrics = new Map(
    input.current.map((item) => [
      item.exerciseId,
      exerciseMetrics(item.exerciseId, sessions),
    ]),
  );
  const highFatigueExercises = [...metrics.values()].filter(
    (m) =>
      m.recentAverageRpe != null &&
      m.recentAverageRpe >= 9.2 &&
      (m.volumeChangePercent ?? 0) <= -5,
  ).length;
  const overloadRisk = lowSleep || hardRecent >= 2 || highFatigueExercises >= 2;

  const changes: string[] = [];
  const items = input.current.map((item) => {
    const metric = metrics.get(item.exerciseId)!;
    if (overloadRisk) {
      const reducedWeight =
        item.targetWeightKg != null
          ? roundHalf(item.targetWeightKg * 0.95)
          : item.targetWeightKg;
      const next =
        item.setScheme === "myo_reps"
          ? {
              ...item,
              targetWeightKg: reducedWeight,
              myoMiniSets: Math.max(1, (item.myoMiniSets ?? 3) - 1),
            }
          : {
              ...item,
              targetWeightKg: reducedWeight,
              targetSets: Math.max(1, item.targetSets - 1),
              targetRestSeconds: Math.min(300, item.targetRestSeconds + 30),
            };
      changes.push(`облегчение позиции ${item.position + 1}`);
      return next;
    }

    if (metric.occurrenceCount < 8) return item;
    let next = item;
    const effortAllowsProgress =
      metric.recentAverageRpe == null || metric.recentAverageRpe <= 8.5;
    const volumeStable = (metric.volumeChangePercent ?? 0) >= -3;
    if (
      effortAllowsProgress &&
      volumeStable &&
      metric.latestTopWeight != null &&
      metric.latestTopReps != null &&
      metric.latestTopReps >= item.targetRepsMax
    ) {
      next = {
        ...next,
        targetWeightKg: roundHalf(metric.latestTopWeight + 2.5),
      };
      changes.push(`+2,5 кг в позиции ${item.position + 1}`);
    }
    if (
      metric.recentAverageRest != null &&
      metric.recentAverageRest > item.targetRestSeconds + 30 &&
      item.setScheme !== "myo_reps"
    ) {
      next = {
        ...next,
        targetRestSeconds: Math.min(
          300,
          Math.round(metric.recentAverageRest / 15) * 15,
        ),
      };
      changes.push(`отдых по факту в позиции ${item.position + 1}`);
    }
    return next;
  });

  const completeness = [
    input.life.sleepHours.length >= 3,
    input.life.nutritionDays >= 3,
    [...metrics.values()].some((m) => m.recentAverageRpe != null),
    [...metrics.values()].some((m) => m.recentAverageRest != null),
  ].filter(Boolean).length;
  const confidence = Math.min(0.9, 0.62 + completeness * 0.06);
  const lifeNotes = [
    sleepAverage != null
      ? `сон в среднем ${sleepAverage.toFixed(1)} ч (${input.life.sleepHours.length} записей)`
      : "сон не записан",
    input.life.averageCalories != null
      ? `питание ${Math.round(input.life.averageCalories)} ккал в среднем (${input.life.nutritionDays} дней)`
      : `питание: ${input.life.nutritionDays} дней без достаточных данных о калориях`,
  ];

  return {
    eligible: true,
    relevantSessionCount: sessions.length,
    confidence,
    overloadRisk,
    requiresConfirmation: overloadRisk,
    summary: overloadRisk
      ? "Предлагается облегчённая следующая тренировка"
      : changes.length > 0
        ? `Консервативно обновлено: ${changes.join("; ")}`
        : "Текущие параметры сохранены",
    rationale: [
      `Проанализированы ${sessions.length} последних тренировок этого шаблона.`,
      lifeNotes.join("; "),
      overloadRisk
        ? "Есть сочетание признаков накопленной усталости. Облегчение не применяется без подтверждения."
        : changes.length > 0
          ? "Изменения сделаны только там, где усилие и динамика объёма не указывают на перегрузку."
          : "Устойчивого сигнала для изменения нагрузки нет.",
      "RIR оценивается только при наличии RPE как 10 − RPE; это ориентир, а не медицинское заключение.",
    ].join(" "),
    items,
  };
}

function exerciseMetrics(
  exerciseId: string,
  sessions: TrendSession[],
): ExerciseMetrics {
  const occurrences = sessions
    .map((session) => session.exercises.find((e) => e.exerciseId === exerciseId))
    .filter((exercise): exercise is TrendExercise => exercise != null);
  const latest = occurrences[0];
  const latestWorking = latest ? workingSets(latest.sets) : [];
  const latestTopWeight =
    latestWorking.length > 0
      ? Math.max(...latestWorking.map((set) => set.weightKg ?? 0))
      : null;
  const latestTopReps =
    latestWorking.length > 0
      ? Math.max(
          ...latestWorking
            .filter((set) => (set.weightKg ?? 0) === (latestTopWeight ?? 0))
            .map((set) => set.reps),
        )
      : null;
  const recentSets = occurrences.slice(0, 3).flatMap((e) => workingSets(e.sets));
  const rpes = recentSets
    .map((set) => set.rpe)
    .filter((value): value is number => value != null);
  const rests = recentSets
    .map((set) => set.restSeconds)
    .filter((value): value is number => value != null && value > 0);
  const volumes = occurrences.map((e) =>
    workingSets(e.sets).reduce(
      (sum, set) => sum + (set.weightKg ?? 0) * set.reps,
      0,
    ),
  );
  const recentVolume = average(volumes.slice(0, 5));
  const olderVolume = average(volumes.slice(5, 10));
  const volumeChangePercent =
    recentVolume != null && olderVolume != null && olderVolume > 0
      ? ((recentVolume - olderVolume) / olderVolume) * 100
      : null;

  return {
    occurrenceCount: occurrences.length,
    latestTopWeight,
    latestTopReps,
    recentAverageRpe: average(rpes),
    recentAverageRest: average(rests),
    volumeChangePercent,
  };
}

function workingSets(sets: TrendSet[]): TrendSet[] {
  return sets.filter((set) => set.setType === "working");
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundHalf(value: number): number {
  return Math.round(value * 2) / 2;
}
