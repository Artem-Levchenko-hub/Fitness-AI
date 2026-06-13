import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { MUSCLE_KEYS } from "@/lib/domain/avatar/heat";
import {
  topMuscleRecords,
  type MuscleRecord,
} from "@/lib/domain/avatar/muscle-records";
import {
  groupExerciseSessions,
  type ExerciseSession,
} from "@/lib/domain/exercise/set-history";
import { estimatedOneRepMax } from "@/lib/domain/progression/one-rep-max";
import { rangeToFromDate, type StatsRange } from "@/lib/domain/stats/range";
import { isoWeekKey } from "@/lib/domain/cycle/iso-week";
import { addDaysIso, isoWeekStartIso } from "@/lib/datetime/iso-week";

// Тип диапазона и дата-отсечка — чистая доменная политика (R-7), живёт в
// lib/domain/stats. Импорт выше даёт локальные привязки для запросов ниже;
// реэкспорт сохраняет публичный API `@/lib/repos/stats.repo` для существующих
// потребителей (app/(app)/stats/page.tsx).
export { rangeToFromDate };
export type { StatsRange };

export type DailyVolumePoint = {
  date: string; // YYYY-MM-DD в timezone юзера
  volume: number;
  sets: number;
  reps: number;
};

/** Объём по дням за период. Учитывает только working подходы. Дни
 *  бакетятся в `timeZone` юзера — РОВНО как история `/workouts` (G1): один и
 *  тот же instant попадает в тот же календарный день в графике и в истории. */
export async function dailyVolume(
  userId: string,
  range: StatsRange,
  timeZone: string,
): Promise<DailyVolumePoint[]> {
  const from = rangeToFromDate(range);

  const rows = await db
    .select({
      day: sql<string>`to_char(${schema.workouts.startedAt} AT TIME ZONE ${timeZone}, 'YYYY-MM-DD')`,
      volume: sql<number>`COALESCE(SUM(${schema.workoutSets.weightKg} * ${schema.workoutSets.reps}), 0)`,
      sets: sql<number>`COUNT(${schema.workoutSets.id})`,
      reps: sql<number>`COALESCE(SUM(${schema.workoutSets.reps}), 0)`,
    })
    .from(schema.workoutSets)
    .innerJoin(
      schema.workoutExercises,
      eq(schema.workoutExercises.id, schema.workoutSets.workoutExerciseId),
    )
    .innerJoin(
      schema.workouts,
      eq(schema.workouts.id, schema.workoutExercises.workoutId),
    )
    .where(
      and(
        eq(schema.workouts.userId, userId),
        eq(schema.workouts.status, "completed"),
        eq(schema.workoutSets.setType, "working"),
        from ? gte(schema.workouts.startedAt, from) : undefined,
      ),
    )
    // Группируем/сортируем по порядковому номеру select-колонки (день в TZ
    // юзера = колонка 1). Параметр TZ в выражении нельзя повторять в GROUP BY:
    // bound-плейсхолдеры ($1 vs $N) не считаются равными → ordinal надёжнее.
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  return rows.map((r) => ({
    date: r.day,
    volume: Number(r.volume),
    sets: Number(r.sets),
    reps: Number(r.reps),
  }));
}

export type WeeklyVolumePoint = {
  weekStart: string; // YYYY-MM-DD понедельника
  volume: number;
  sets: number;
  reps: number;
};

/** Объём по неделям (ISO неделя, начало — понедельник). Границы недели
 *  считаются в `timeZone` юзера — РОВНО как история `/workouts` (G1). */
export async function weeklyVolume(
  userId: string,
  range: StatsRange,
  timeZone: string,
): Promise<WeeklyVolumePoint[]> {
  const from = rangeToFromDate(range);

  const rows = await db
    .select({
      week: sql<string>`to_char(date_trunc('week', ${schema.workouts.startedAt} AT TIME ZONE ${timeZone}), 'YYYY-MM-DD')`,
      volume: sql<number>`COALESCE(SUM(${schema.workoutSets.weightKg} * ${schema.workoutSets.reps}), 0)`,
      sets: sql<number>`COUNT(${schema.workoutSets.id})`,
      reps: sql<number>`COALESCE(SUM(${schema.workoutSets.reps}), 0)`,
    })
    .from(schema.workoutSets)
    .innerJoin(
      schema.workoutExercises,
      eq(schema.workoutExercises.id, schema.workoutSets.workoutExerciseId),
    )
    .innerJoin(
      schema.workouts,
      eq(schema.workouts.id, schema.workoutExercises.workoutId),
    )
    .where(
      and(
        eq(schema.workouts.userId, userId),
        eq(schema.workouts.status, "completed"),
        eq(schema.workoutSets.setType, "working"),
        from ? gte(schema.workouts.startedAt, from) : undefined,
      ),
    )
    // Ordinal-группировка (неделя в TZ юзера = колонка 1): bound-параметр TZ
    // нельзя повторять в GROUP BY (см. dailyVolume).
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  return rows.map((r) => ({
    weekStart: r.week,
    volume: Number(r.volume),
    sets: Number(r.sets),
    reps: Number(r.reps),
  }));
}

export type MuscleVolumePoint = {
  muscleKey: string;
  volume: number;
};

/** Объём по группам мышц (primary 1.0 / secondary 0.5). */
export async function volumeByMuscle(
  userId: string,
  range: StatsRange,
): Promise<MuscleVolumePoint[]> {
  const from = rangeToFromDate(range);

  const rows = await db
    .select({
      muscle: schema.exerciseMuscleGroups.muscleGroupKey,
      role: schema.exerciseMuscleGroups.role,
      volume: sql<number>`COALESCE(SUM(${schema.workoutSets.weightKg} * ${schema.workoutSets.reps}), 0)`,
    })
    .from(schema.workoutSets)
    .innerJoin(
      schema.workoutExercises,
      eq(schema.workoutExercises.id, schema.workoutSets.workoutExerciseId),
    )
    .innerJoin(
      schema.workouts,
      eq(schema.workouts.id, schema.workoutExercises.workoutId),
    )
    .innerJoin(
      schema.exerciseMuscleGroups,
      eq(
        schema.exerciseMuscleGroups.exerciseId,
        schema.workoutExercises.exerciseId,
      ),
    )
    .where(
      and(
        eq(schema.workouts.userId, userId),
        eq(schema.workouts.status, "completed"),
        eq(schema.workoutSets.setType, "working"),
        from ? gte(schema.workouts.startedAt, from) : undefined,
      ),
    )
    .groupBy(
      schema.exerciseMuscleGroups.muscleGroupKey,
      schema.exerciseMuscleGroups.role,
    );

  const acc = new Map<string, number>();
  for (const r of rows) {
    const factor = r.role === "primary" ? 1 : 0.5;
    acc.set(r.muscle, (acc.get(r.muscle) ?? 0) + Number(r.volume) * factor);
  }
  return Array.from(acc.entries())
    .map(([muscleKey, volume]) => ({ muscleKey, volume }))
    .sort((a, b) => b.volume - a.volume);
}

export type RepRangePoint = {
  bucket: "1-5" | "6-10" | "11-15" | "16+";
  sets: number;
};

/** Распределение working-подходов по rep-диапазонам — power/hypertrophy/
 *  endurance split. */
export async function repRangeDistribution(
  userId: string,
  range: StatsRange,
): Promise<RepRangePoint[]> {
  const from = rangeToFromDate(range);

  const rows = await db
    .select({
      reps: schema.workoutSets.reps,
    })
    .from(schema.workoutSets)
    .innerJoin(
      schema.workoutExercises,
      eq(schema.workoutExercises.id, schema.workoutSets.workoutExerciseId),
    )
    .innerJoin(
      schema.workouts,
      eq(schema.workouts.id, schema.workoutExercises.workoutId),
    )
    .where(
      and(
        eq(schema.workouts.userId, userId),
        eq(schema.workouts.status, "completed"),
        eq(schema.workoutSets.setType, "working"),
        from ? gte(schema.workouts.startedAt, from) : undefined,
      ),
    );

  const buckets = { "1-5": 0, "6-10": 0, "11-15": 0, "16+": 0 };
  for (const r of rows) {
    if (r.reps <= 5) buckets["1-5"] += 1;
    else if (r.reps <= 10) buckets["6-10"] += 1;
    else if (r.reps <= 15) buckets["11-15"] += 1;
    else buckets["16+"] += 1;
  }
  return [
    { bucket: "1-5", sets: buckets["1-5"] },
    { bucket: "6-10", sets: buckets["6-10"] },
    { bucket: "11-15", sets: buckets["11-15"] },
    { bucket: "16+", sets: buckets["16+"] },
  ];
}

export type OneRmTrendPoint = {
  date: string;
  estimated1Rm: number;
};

/** Trend оценочного 1RM по выбранному упражнению — best e1RM в каждой
 *  тренировке где выполнено. */
export async function oneRmTrend(
  userId: string,
  exerciseId: string,
  range: StatsRange,
  timeZone: string,
): Promise<OneRmTrendPoint[]> {
  const from = rangeToFromDate(range);

  // Достаём все working-подходы; e1RM считаем общей доменной функцией
  // (Epley × Brzycki avg с корректным фолбэком на высокоповторных, R-04).
  // Дни группируем в timezone юзера (G1 — как история `/workouts`).
  const rows = await db
    .select({
      date: sql<string>`to_char(${schema.workouts.startedAt} AT TIME ZONE ${timeZone}, 'YYYY-MM-DD')`,
      weight: schema.workoutSets.weightKg,
      reps: schema.workoutSets.reps,
    })
    .from(schema.workoutSets)
    .innerJoin(
      schema.workoutExercises,
      eq(schema.workoutExercises.id, schema.workoutSets.workoutExerciseId),
    )
    .innerJoin(
      schema.workouts,
      eq(schema.workouts.id, schema.workoutExercises.workoutId),
    )
    .where(
      and(
        eq(schema.workouts.userId, userId),
        eq(schema.workouts.status, "completed"),
        eq(schema.workoutExercises.exerciseId, exerciseId),
        eq(schema.workoutSets.setType, "working"),
        from ? gte(schema.workouts.startedAt, from) : undefined,
      ),
    )
    .orderBy(asc(schema.workouts.startedAt));

  const byDay = new Map<string, number>();
  for (const r of rows) {
    const e1 = estimatedOneRepMax(r.weight, r.reps);
    if (e1 <= 0) continue;
    const prev = byDay.get(r.date) ?? 0;
    if (e1 > prev) byDay.set(r.date, e1);
  }

  return Array.from(byDay.entries())
    .map(([date, estimated1Rm]) => ({ date, estimated1Rm }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type FrequencyPoint = {
  date: string;
  count: number;
};

/** Календарная активность — сколько тренировок в каждый день
 *  (для heatmap-графика). Дни — в timezone юзера (G1, как `/workouts`). */
export async function workoutFrequency(
  userId: string,
  range: StatsRange,
  timeZone: string,
): Promise<FrequencyPoint[]> {
  const from = rangeToFromDate(range);

  const rows = await db
    .select({
      date: sql<string>`to_char(${schema.workouts.startedAt} AT TIME ZONE ${timeZone}, 'YYYY-MM-DD')`,
      count: sql<number>`COUNT(*)`,
    })
    .from(schema.workouts)
    .where(
      and(
        eq(schema.workouts.userId, userId),
        eq(schema.workouts.status, "completed"),
        from ? gte(schema.workouts.startedAt, from) : undefined,
      ),
    )
    // Ordinal-группировка (день в TZ юзера = колонка 1): bound-параметр TZ
    // нельзя повторять в GROUP BY (см. dailyVolume).
    .groupBy(sql`1`);

  return rows.map((r) => ({
    date: r.date,
    count: Number(r.count),
  }));
}

export type TopLineKpi = {
  workouts: number;
  totalSets: number;
  totalReps: number;
  totalTonnageKg: number;
};

/** Главные KPI-карточки на /stats. */
export async function topLineKpi(
  userId: string,
  range: StatsRange,
): Promise<TopLineKpi> {
  const from = rangeToFromDate(range);

  const [agg] = await db
    .select({
      workouts: sql<number>`COUNT(DISTINCT ${schema.workouts.id})`,
      sets: sql<number>`COUNT(${schema.workoutSets.id})`,
      reps: sql<number>`COALESCE(SUM(${schema.workoutSets.reps}), 0)`,
      tonnage: sql<number>`COALESCE(SUM(${schema.workoutSets.weightKg} * ${schema.workoutSets.reps}), 0)`,
    })
    .from(schema.workouts)
    .leftJoin(
      schema.workoutExercises,
      eq(schema.workoutExercises.workoutId, schema.workouts.id),
    )
    .leftJoin(
      schema.workoutSets,
      and(
        eq(schema.workoutSets.workoutExerciseId, schema.workoutExercises.id),
        eq(schema.workoutSets.setType, "working"),
      ),
    )
    .where(
      and(
        eq(schema.workouts.userId, userId),
        eq(schema.workouts.status, "completed"),
        from ? gte(schema.workouts.startedAt, from) : undefined,
      ),
    );

  return {
    workouts: Number(agg?.workouts ?? 0),
    totalSets: Number(agg?.sets ?? 0),
    totalReps: Number(agg?.reps ?? 0),
    totalTonnageKg: Number(agg?.tonnage ?? 0),
  };
}

export type PeriodVolumeComparison = {
  /** Working-тоннаж за текущее окно периода. */
  current: number;
  /** Working-тоннаж за предыдущее окно той же длины, или null если сравнить
   *  не с чем (range='all' — нет ограниченного прошлого окна). */
  previous: number | null;
};

/** Working-тоннаж (вес × повторы) за произвольное окно [from, to). Только
 *  completed-тренировки (G1). `from`/`to` null → без соответствующей границы. */
async function workingTonnage(
  userId: string,
  from: Date | null,
  to: Date | null,
): Promise<number> {
  const [agg] = await db
    .select({
      tonnage: sql<number>`COALESCE(SUM(${schema.workoutSets.weightKg} * ${schema.workoutSets.reps}), 0)`,
    })
    .from(schema.workoutSets)
    .innerJoin(
      schema.workoutExercises,
      eq(schema.workoutExercises.id, schema.workoutSets.workoutExerciseId),
    )
    .innerJoin(
      schema.workouts,
      eq(schema.workouts.id, schema.workoutExercises.workoutId),
    )
    .where(
      and(
        eq(schema.workouts.userId, userId),
        eq(schema.workouts.status, "completed"),
        eq(schema.workoutSets.setType, "working"),
        from ? gte(schema.workouts.startedAt, from) : undefined,
        to ? lt(schema.workouts.startedAt, to) : undefined,
      ),
    );

  return Number(agg?.tonnage ?? 0);
}

/** Сравнение объёма текущего периода с предыдущим окном той же длины —
 *  для человекочитаемого вывода «растёшь/стоишь/падаешь» (G6). */
export async function periodVolumeComparison(
  userId: string,
  range: StatsRange,
): Promise<PeriodVolumeComparison> {
  const from = rangeToFromDate(range);

  // range='all' → окно неограниченно, сравнивать не с чем.
  if (!from) {
    const current = await workingTonnage(userId, null, null);
    return { current, previous: null };
  }

  const lengthMs = Date.now() - from.getTime();
  const prevFrom = new Date(from.getTime() - lengthMs);

  const [current, previous] = await Promise.all([
    workingTonnage(userId, from, null),
    workingTonnage(userId, prevFrom, from),
  ]);

  return { current, previous };
}

export type ExerciseTrend = {
  exerciseId: string;
  name: string;
  /** Лучший оценочный 1RM (кг) за текущее окно периода. */
  currentE1rm: number;
  /** Лучший оценочный 1RM (кг) за предыдущее окно той же длины. */
  previousE1rm: number;
};

/** Лучший e1RM по каждому упражнению за окно [from, to). Только completed +
 *  working подходы (G1). */
async function bestE1rmByExercise(
  userId: string,
  from: Date | null,
  to: Date | null,
): Promise<Map<string, { name: string; e1rm: number }>> {
  const rows = await db
    .select({
      exerciseId: schema.workoutExercises.exerciseId,
      name: schema.exercises.nameRu,
      weight: schema.workoutSets.weightKg,
      reps: schema.workoutSets.reps,
    })
    .from(schema.workoutSets)
    .innerJoin(
      schema.workoutExercises,
      eq(schema.workoutExercises.id, schema.workoutSets.workoutExerciseId),
    )
    .innerJoin(
      schema.workouts,
      eq(schema.workouts.id, schema.workoutExercises.workoutId),
    )
    .innerJoin(
      schema.exercises,
      eq(schema.exercises.id, schema.workoutExercises.exerciseId),
    )
    .where(
      and(
        eq(schema.workouts.userId, userId),
        eq(schema.workouts.status, "completed"),
        eq(schema.workoutSets.setType, "working"),
        from ? gte(schema.workouts.startedAt, from) : undefined,
        to ? lt(schema.workouts.startedAt, to) : undefined,
      ),
    );

  const best = new Map<string, { name: string; e1rm: number }>();
  for (const r of rows) {
    const e1 = estimatedOneRepMax(r.weight, r.reps);
    const prev = best.get(r.exerciseId);
    if (!prev || e1 > prev.e1rm) {
      best.set(r.exerciseId, { name: r.name, e1rm: e1 });
    }
  }
  return best;
}

/** Упражнение с наибольшим РОСТОМ оценочного 1RM: текущее окно периода против
 *  предыдущего окна той же длины (G6 — «понятный вывод по конкретному
 *  движению словами»). Сравниваем только упражнения с данными в ОБОИХ окнах —
 *  честное сравнение, без ложного «прогресса с нуля» (G5). range='all' → null
 *  (нет ограниченного прошлого окна для сравнения). */
export async function topMoverByE1rm(
  userId: string,
  range: StatsRange,
): Promise<ExerciseTrend | null> {
  const from = rangeToFromDate(range);
  if (!from) return null;

  const lengthMs = Date.now() - from.getTime();
  const prevFrom = new Date(from.getTime() - lengthMs);

  const [current, previous] = await Promise.all([
    bestE1rmByExercise(userId, from, null),
    bestE1rmByExercise(userId, prevFrom, from),
  ]);

  let top: ExerciseTrend | null = null;
  let bestGain = 0;
  for (const [exerciseId, cur] of current) {
    const prev = previous.get(exerciseId);
    if (!prev || prev.e1rm <= 0) continue; // нет базы в прошлом окне
    const gain = (cur.e1rm - prev.e1rm) / prev.e1rm;
    if (top === null || gain > bestGain) {
      bestGain = gain;
      top = {
        exerciseId,
        name: cur.name,
        currentE1rm: cur.e1rm,
        previousE1rm: prev.e1rm,
      };
    }
  }
  return top;
}

export type MuscleHeat = {
  muscleKey: string;
  /** Эффективные рабочие подходы за неделю (primary 1.0 / secondary 0.5;
   *  силовые + круговые) — вход для нагрева аватара. */
  weeklySets: number;
  /** Целое число подходов, задевших группу за неделю (для панели). */
  sets: number;
  /** Working-тоннаж группы за неделю (кг·повт), там где есть вес/повторы. */
  volume7d: number;
  /** Когда группа в последний раз работала за неделю. null = не на этой неделе. */
  lastTrainedAt: Date | null;
  /** Топ-3 упражнения по вкладу в группу за неделю. */
  top3: Array<{ exerciseId: string; name: string; volume: number }>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Унифицированная строка «подход × группа мышц» из любого формата. */
type HeatRow = {
  /** Уникальный id подхода (s:setId для силовых, c:logId для круговых) —
   *  чтобы один подход не считался дважды по разным группам. */
  sourceId: string;
  muscle: string;
  role: "primary" | "secondary";
  weight: number | null;
  reps: number | null;
  exerciseId: string;
  exName: string;
  at: Date;
};

/** Профиль «нагрева» всех 14 групп мышц для 3D-аватара за последнюю неделю.
 *  Нагрев = АБСОЛЮТНОЕ число эффективных рабочих подходов на группу (см.
 *  доменный `heatFromSets`): серый → красный. Считает И силовые подходы, И
 *  круговые (circuit_round_logs) — иначе круговая тренировка не «грела» бы тело
 *  (баг: пользователь тренировался круговыми, а аватар оставался серым).
 *  Только completed-сессии (G1).
 *
 *  Возвращает РОВНО 14 записей в порядке MUSCLE_KEYS (нетренированные — нулями).
 *  primary = полный подход, secondary = 0.5 (стандарт оценки нагрузки). */
export async function muscleHeatProfile(
  userId: string,
  now: Date,
): Promise<MuscleHeat[]> {
  const from = new Date(now.getTime() - 7 * DAY_MS);

  // Силовые рабочие подходы за неделю.
  const strengthRows = await db
    .select({
      setId: schema.workoutSets.id,
      muscle: schema.exerciseMuscleGroups.muscleGroupKey,
      role: schema.exerciseMuscleGroups.role,
      weight: schema.workoutSets.weightKg,
      reps: schema.workoutSets.reps,
      exerciseId: schema.workoutExercises.exerciseId,
      exName: schema.exercises.nameRu,
      at: schema.workouts.startedAt,
    })
    .from(schema.workoutSets)
    .innerJoin(
      schema.workoutExercises,
      eq(schema.workoutExercises.id, schema.workoutSets.workoutExerciseId),
    )
    .innerJoin(
      schema.workouts,
      eq(schema.workouts.id, schema.workoutExercises.workoutId),
    )
    .innerJoin(
      schema.exerciseMuscleGroups,
      eq(
        schema.exerciseMuscleGroups.exerciseId,
        schema.workoutExercises.exerciseId,
      ),
    )
    .innerJoin(
      schema.exercises,
      eq(schema.exercises.id, schema.workoutExercises.exerciseId),
    )
    .where(
      and(
        eq(schema.workouts.userId, userId),
        eq(schema.workouts.status, "completed"),
        eq(schema.workoutSets.setType, "working"),
        gte(schema.workouts.startedAt, from),
      ),
    );

  // Круговые: каждый невыполненный-пропуск лог раунда = один подход своего
  // упражнения (completed-сессии). Вес/повторы — если есть (часто bodyweight).
  const circuitRows = await db
    .select({
      logId: schema.circuitRoundLogs.id,
      muscle: schema.exerciseMuscleGroups.muscleGroupKey,
      role: schema.exerciseMuscleGroups.role,
      weight: schema.circuitRoundLogs.actualWeightKg,
      reps: schema.circuitRoundLogs.actualReps,
      exerciseId: schema.circuitExercises.exerciseId,
      exName: schema.exercises.nameRu,
      at: schema.circuitRoundLogs.completedAt,
    })
    .from(schema.circuitRoundLogs)
    .innerJoin(
      schema.circuitExercises,
      eq(schema.circuitExercises.id, schema.circuitRoundLogs.circuitExerciseId),
    )
    .innerJoin(
      schema.circuitWorkouts,
      eq(schema.circuitWorkouts.id, schema.circuitRoundLogs.circuitWorkoutId),
    )
    .innerJoin(
      schema.exerciseMuscleGroups,
      eq(
        schema.exerciseMuscleGroups.exerciseId,
        schema.circuitExercises.exerciseId,
      ),
    )
    .innerJoin(
      schema.exercises,
      eq(schema.exercises.id, schema.circuitExercises.exerciseId),
    )
    .where(
      and(
        eq(schema.circuitWorkouts.userId, userId),
        eq(schema.circuitWorkouts.status, "completed"),
        eq(schema.circuitRoundLogs.skipped, false),
        gte(schema.circuitRoundLogs.completedAt, from),
      ),
    );

  const rows: HeatRow[] = [
    ...strengthRows.map((r) => ({ ...r, sourceId: `s:${r.setId}` })),
    ...circuitRows.map((r) => ({ ...r, sourceId: `c:${r.logId}` })),
  ];

  type Acc = {
    /** sourceId → максимальный role-вес (primary вытесняет secondary). */
    setWeights: Map<string, number>;
    volume: number;
    lastTrainedAt: Date | null;
    exVolume: Map<string, { name: string; volume: number }>;
  };
  const byMuscle = new Map<string, Acc>();
  const ensure = (key: string): Acc => {
    let a = byMuscle.get(key);
    if (!a) {
      a = { setWeights: new Map(), volume: 0, lastTrainedAt: null, exVolume: new Map() };
      byMuscle.set(key, a);
    }
    return a;
  };

  for (const r of rows) {
    const w = r.role === "primary" ? 1 : 0.5;
    const acc = ensure(r.muscle);
    if ((acc.setWeights.get(r.sourceId) ?? 0) < w) acc.setWeights.set(r.sourceId, w);
    if (r.weight != null && r.reps != null) {
      const vol = r.weight * r.reps * w;
      acc.volume += vol;
      const ex = acc.exVolume.get(r.exerciseId);
      if (ex) ex.volume += vol;
      else acc.exVolume.set(r.exerciseId, { name: r.exName, volume: vol });
    }
    if (!acc.lastTrainedAt || r.at > acc.lastTrainedAt) acc.lastTrainedAt = r.at;
  }

  return MUSCLE_KEYS.map((key) => {
    const a = byMuscle.get(key);
    if (!a) {
      return {
        muscleKey: key,
        weeklySets: 0,
        sets: 0,
        volume7d: 0,
        lastTrainedAt: null,
        top3: [],
      };
    }
    let weeklySets = 0;
    for (const wt of a.setWeights.values()) weeklySets += wt;
    const top3 = Array.from(a.exVolume.entries())
      .map(([exerciseId, v]) => ({ exerciseId, name: v.name, volume: v.volume }))
      .sort((x, y) => y.volume - x.volume)
      .slice(0, 3);
    return {
      muscleKey: key,
      weeklySets,
      sets: a.setWeights.size,
      volume7d: a.volume,
      lastTrainedAt: a.lastTrainedAt,
      top3,
    };
  });
}

/** Всевременная дата последней нагрузки на каждую группу мышц (H6.4 «забытые
 *  мышцы»). Нужна отдельно от `muscleHeatProfile` (та смотрит только окно 7
 *  дней → не отличает «2 недели назад» от «никогда»). Берёт максимум даты по
 *  силовым working-подходам И круговым логам (completed), агрегирует в SQL
 *  (max + groupBy), сливает два источника по максимуму в JS. Группы без истории
 *  в Map отсутствуют. */
export async function muscleLastTrained(
  userId: string,
): Promise<Map<string, Date>> {
  const strength = await db
    .select({
      muscle: schema.exerciseMuscleGroups.muscleGroupKey,
      at: sql<Date>`max(${schema.workouts.startedAt})`.as("at"),
    })
    .from(schema.workoutSets)
    .innerJoin(
      schema.workoutExercises,
      eq(schema.workoutExercises.id, schema.workoutSets.workoutExerciseId),
    )
    .innerJoin(
      schema.workouts,
      eq(schema.workouts.id, schema.workoutExercises.workoutId),
    )
    .innerJoin(
      schema.exerciseMuscleGroups,
      eq(
        schema.exerciseMuscleGroups.exerciseId,
        schema.workoutExercises.exerciseId,
      ),
    )
    .where(
      and(
        eq(schema.workouts.userId, userId),
        eq(schema.workouts.status, "completed"),
        eq(schema.workoutSets.setType, "working"),
      ),
    )
    .groupBy(schema.exerciseMuscleGroups.muscleGroupKey);

  const circuit = await db
    .select({
      muscle: schema.exerciseMuscleGroups.muscleGroupKey,
      at: sql<Date>`max(${schema.circuitRoundLogs.completedAt})`.as("at"),
    })
    .from(schema.circuitRoundLogs)
    .innerJoin(
      schema.circuitExercises,
      eq(schema.circuitExercises.id, schema.circuitRoundLogs.circuitExerciseId),
    )
    .innerJoin(
      schema.circuitWorkouts,
      eq(schema.circuitWorkouts.id, schema.circuitRoundLogs.circuitWorkoutId),
    )
    .innerJoin(
      schema.exerciseMuscleGroups,
      eq(
        schema.exerciseMuscleGroups.exerciseId,
        schema.circuitExercises.exerciseId,
      ),
    )
    .where(
      and(
        eq(schema.circuitWorkouts.userId, userId),
        eq(schema.circuitWorkouts.status, "completed"),
        eq(schema.circuitRoundLogs.skipped, false),
      ),
    )
    .groupBy(schema.exerciseMuscleGroups.muscleGroupKey);

  const map = new Map<string, Date>();
  for (const r of [...strength, ...circuit]) {
    if (!r.at) continue;
    const d = r.at instanceof Date ? r.at : new Date(r.at);
    const cur = map.get(r.muscle);
    if (!cur || d > cur) map.set(r.muscle, d);
  }
  return map;
}

/** All-time PR-рекорды по группам мышц для дрилл-дауна аватара (H6.1).
 *  Для каждой группы — топ упражнений по оценочному 1ПМ с их рекордным
 *  подходом (вес × повторы). Только primary-роль: рекорд приписывается группе,
 *  которую упражнение тренирует ОСНОВНОЙ (жим — груди, не трицепсу), без
 *  двойного учёта. Только силовые completed + working подходы (кардио/круговые
 *  bodyweight без веса PR не образуют). Возвращает Map по `muscleKey`. */
export async function muscleGroupRecords(
  userId: string,
): Promise<Map<string, MuscleRecord[]>> {
  const rows = await db
    .select({
      muscleKey: schema.exerciseMuscleGroups.muscleGroupKey,
      exerciseId: schema.workoutExercises.exerciseId,
      name: schema.exercises.nameRu,
      weightKg: schema.workoutSets.weightKg,
      reps: schema.workoutSets.reps,
    })
    .from(schema.workoutSets)
    .innerJoin(
      schema.workoutExercises,
      eq(schema.workoutExercises.id, schema.workoutSets.workoutExerciseId),
    )
    .innerJoin(
      schema.workouts,
      eq(schema.workouts.id, schema.workoutExercises.workoutId),
    )
    .innerJoin(
      schema.exerciseMuscleGroups,
      eq(
        schema.exerciseMuscleGroups.exerciseId,
        schema.workoutExercises.exerciseId,
      ),
    )
    .innerJoin(
      schema.exercises,
      eq(schema.exercises.id, schema.workoutExercises.exerciseId),
    )
    .where(
      and(
        eq(schema.workouts.userId, userId),
        eq(schema.workouts.status, "completed"),
        eq(schema.workoutSets.setType, "working"),
        eq(schema.exerciseMuscleGroups.role, "primary"),
      ),
    );

  return topMuscleRecords(
    rows
      .filter((r) => r.weightKg != null && r.reps != null)
      .map((r) => ({
        muscleKey: r.muscleKey,
        exerciseId: r.exerciseId,
        name: r.name,
        weightKg: r.weightKg as number,
        reps: r.reps as number,
      })),
  );
}

/** Список упражнений, с которыми хоть раз тренировались — для селектора
 *  1RM trend. */
export async function trainedExercises(
  userId: string,
): Promise<Array<{ id: string; nameRu: string }>> {
  const rows = await db
    .selectDistinct({
      id: schema.workoutExercises.exerciseId,
      nameRu: schema.exercises.nameRu,
    })
    .from(schema.workoutExercises)
    .innerJoin(
      schema.workouts,
      eq(schema.workouts.id, schema.workoutExercises.workoutId),
    )
    .innerJoin(
      schema.exercises,
      eq(schema.exercises.id, schema.workoutExercises.exerciseId),
    )
    .where(
      and(
        eq(schema.workouts.userId, userId),
        eq(schema.workouts.status, "completed"),
      ),
    )
    .orderBy(asc(schema.exercises.nameRu));

  return rows;
}

export type { ExerciseSession };

/** История подходов одного упражнения по сессиям (новые сверху). Только
 *  completed-тренировки этого юзера; все типы подходов (working/warmup/...)
 *  показываются, e1RM считается доменом по working. Группировка — чистый
 *  доменный модуль (groupExerciseSessions, R-7). */
export async function exerciseSetHistory(
  userId: string,
  exerciseId: string,
  limit = 30,
): Promise<ExerciseSession[]> {
  const rows = await db
    .select({
      workoutId: schema.workouts.id,
      startedAt: schema.workouts.startedAt,
      setId: schema.workoutSets.id,
      setIndex: schema.workoutSets.setIndex,
      weightKg: schema.workoutSets.weightKg,
      reps: schema.workoutSets.reps,
      rpe: schema.workoutSets.rpe,
      setType: schema.workoutSets.setType,
    })
    .from(schema.workoutSets)
    .innerJoin(
      schema.workoutExercises,
      eq(schema.workoutExercises.id, schema.workoutSets.workoutExerciseId),
    )
    .innerJoin(
      schema.workouts,
      eq(schema.workouts.id, schema.workoutExercises.workoutId),
    )
    .where(
      and(
        eq(schema.workouts.userId, userId),
        eq(schema.workouts.status, "completed"),
        eq(schema.workoutExercises.exerciseId, exerciseId),
      ),
    )
    .orderBy(desc(schema.workouts.startedAt), asc(schema.workoutSets.setIndex));

  return groupExerciseSessions(rows, limit);
}

/** Агрегаты одной ISO-недели для недельного разбора тренера (H8.1). */
export type WeeklyAgg = {
  sessions: number;
  tonnage: number;
  sets: number;
  muscleVolumes: { muscleKey: string; volume: number }[];
};

export type WeeklyReviewData = {
  weekStart: string;
  prevWeekStart: string;
  current: WeeklyAgg;
  previous: WeeklyAgg;
  cycleNote: string | null;
  /** Ночи сна за разбираемую (текущую) ISO-неделю — H11.1: недельный тренер
   *  оценивает восстановление по реальным строкам, а не врёт «нет данных». */
  sleep: { date: string; hours: number; quality: number | null }[];
  /** Дни питания за разбираемую ISO-неделю (ккал + белок). */
  nutrition: { date: string; kcal: number | null; proteinG: number | null }[];
};

const WEEKLY_REVIEW_SCAN_DAYS = 21;

/** Силовые агрегаты текущей и прошлой ISO-недели + заметка текущей недели —
 *  вход недельного разбора тренера (H8.1). Только completed + working подходы,
 *  как /stats. Границы недели бакетятся в TZ юзера (`date_trunc('week', …)` =
 *  понедельник), что совпадает с `isoWeekStartIso` — выбираем нужные две недели
 *  по строке-ключу. Loose lower-bound (последние 21 день) ограничивает скан;
 *  точное распределение по неделям даёт bucket-строка. */
export async function weeklyReviewData(
  userId: string,
  now: Date,
  timeZone: string,
): Promise<WeeklyReviewData> {
  const weekStart = isoWeekStartIso(now, timeZone);
  const prevWeekStart = addDaysIso(weekStart, -7);
  const from = new Date(now.getTime() - WEEKLY_REVIEW_SCAN_DAYS * DAY_MS);
  const weekExpr = sql<string>`to_char(date_trunc('week', ${schema.workouts.startedAt} AT TIME ZONE ${timeZone}), 'YYYY-MM-DD')`;

  // (A) Объём/сессии/подходы по неделям.
  const totalsRows = await db
    .select({
      week: weekExpr,
      sessions: sql<number>`COUNT(DISTINCT ${schema.workouts.id})`,
      tonnage: sql<number>`COALESCE(SUM(${schema.workoutSets.weightKg} * ${schema.workoutSets.reps}), 0)`,
      sets: sql<number>`COUNT(${schema.workoutSets.id})`,
    })
    .from(schema.workoutSets)
    .innerJoin(
      schema.workoutExercises,
      eq(schema.workoutExercises.id, schema.workoutSets.workoutExerciseId),
    )
    .innerJoin(
      schema.workouts,
      eq(schema.workouts.id, schema.workoutExercises.workoutId),
    )
    .where(
      and(
        eq(schema.workouts.userId, userId),
        eq(schema.workouts.status, "completed"),
        eq(schema.workoutSets.setType, "working"),
        gte(schema.workouts.startedAt, from),
      ),
    )
    .groupBy(sql`1`);

  // (B) Тоннаж по неделе × группе × роли (role-fold в JS, как volumeByMuscle).
  const muscleRows = await db
    .select({
      week: weekExpr,
      muscle: schema.exerciseMuscleGroups.muscleGroupKey,
      role: schema.exerciseMuscleGroups.role,
      volume: sql<number>`COALESCE(SUM(${schema.workoutSets.weightKg} * ${schema.workoutSets.reps}), 0)`,
    })
    .from(schema.workoutSets)
    .innerJoin(
      schema.workoutExercises,
      eq(schema.workoutExercises.id, schema.workoutSets.workoutExerciseId),
    )
    .innerJoin(
      schema.workouts,
      eq(schema.workouts.id, schema.workoutExercises.workoutId),
    )
    .innerJoin(
      schema.exerciseMuscleGroups,
      eq(
        schema.exerciseMuscleGroups.exerciseId,
        schema.workoutExercises.exerciseId,
      ),
    )
    .where(
      and(
        eq(schema.workouts.userId, userId),
        eq(schema.workouts.status, "completed"),
        eq(schema.workoutSets.setType, "working"),
        gte(schema.workouts.startedAt, from),
      ),
    )
    .groupBy(
      sql`1`,
      schema.exerciseMuscleGroups.muscleGroupKey,
      schema.exerciseMuscleGroups.role,
    );

  const buildAgg = (weekKey: string): WeeklyAgg => {
    const t = totalsRows.find((r) => r.week === weekKey);
    const byMuscle = new Map<string, number>();
    for (const r of muscleRows) {
      if (r.week !== weekKey) continue;
      const factor = r.role === "primary" ? 1 : 0.5;
      byMuscle.set(
        r.muscle,
        (byMuscle.get(r.muscle) ?? 0) + Number(r.volume) * factor,
      );
    }
    return {
      sessions: Number(t?.sessions ?? 0),
      tonnage: Number(t?.tonnage ?? 0),
      sets: Number(t?.sets ?? 0),
      muscleVolumes: Array.from(byMuscle.entries())
        .map(([muscleKey, volume]) => ({ muscleKey, volume }))
        .sort((a, b) => b.volume - a.volume),
    };
  };

  const [note] = await db
    .select({ content: schema.cycleNotes.content })
    .from(schema.cycleNotes)
    .where(
      and(
        eq(schema.cycleNotes.userId, userId),
        eq(schema.cycleNotes.weekIso, isoWeekKey(now)),
      ),
    )
    .orderBy(desc(schema.cycleNotes.updatedAt))
    .limit(1);

  // (D) Сон/питание за РАЗБИРАЕМУЮ (текущую) ISO-неделю [weekStart, +7).
  //     date — строковая колонка YYYY-MM-DD, границы лексикографичны (H11.1).
  const weekEnd = addDaysIso(weekStart, 7);
  const sleepRows = await db
    .select({
      date: schema.sleepLogs.date,
      hours: schema.sleepLogs.hours,
      quality: schema.sleepLogs.quality,
    })
    .from(schema.sleepLogs)
    .where(
      and(
        eq(schema.sleepLogs.userId, userId),
        gte(schema.sleepLogs.date, weekStart),
        lt(schema.sleepLogs.date, weekEnd),
      ),
    )
    .orderBy(asc(schema.sleepLogs.date));

  const nutritionRows = await db
    .select({
      date: schema.nutritionEntries.date,
      kcal: schema.nutritionEntries.kcal,
      proteinG: schema.nutritionEntries.proteinG,
    })
    .from(schema.nutritionEntries)
    .where(
      and(
        eq(schema.nutritionEntries.userId, userId),
        gte(schema.nutritionEntries.date, weekStart),
        lt(schema.nutritionEntries.date, weekEnd),
      ),
    )
    .orderBy(asc(schema.nutritionEntries.date));

  return {
    weekStart,
    prevWeekStart,
    current: buildAgg(weekStart),
    previous: buildAgg(prevWeekStart),
    cycleNote: note?.content ?? null,
    sleep: sleepRows,
    nutrition: nutritionRows,
  };
}
