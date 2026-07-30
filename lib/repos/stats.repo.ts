import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { mergeDailyFrequency } from "@/lib/domain/stats/frequency-merge";
import { MUSCLE_KEYS } from "@/lib/domain/avatar/heat";
import {
  weeklyVolumeSeries,
  type WeeklyVolumeContribution,
} from "@/lib/domain/avatar/weekly-volume";
import {
  topMuscleRecords,
  type MuscleRecord,
} from "@/lib/domain/avatar/muscle-records";
import {
  groupExerciseSessions,
  type ExerciseSession,
} from "@/lib/domain/exercise/set-history";
import {
  selectKeyMovements,
  type WeeklyKeyMovement,
} from "@/lib/ai/weekly-review";
import { estimatedOneRepMax } from "@/lib/domain/progression/one-rep-max";
import {
  combineActivityTotals,
  type ActivityTotals,
} from "@/lib/domain/stats/activity-totals";
import {
  mergeVolumeBuckets,
  type VolumeBucket,
} from "@/lib/domain/stats/volume-merge";
import {
  foldMuscleVolume,
  roleFactor,
  type MuscleVolumeRow,
} from "@/lib/domain/stats/muscle-volume";
import {
  distributeRepRanges,
  type RepRangePoint,
} from "@/lib/domain/stats/rep-ranges";
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

/** Объём силовых working-подходов по бакету (день/неделя) в TZ юзера. Возвращает
 *  нормализованные `VolumeBucket` (ключ = день 'YYYY-MM-DD' или понедельник
 *  недели) для слияния с круговыми. Дни/недели бакетятся РОВНО как история
 *  `/workouts` (G1). */
async function strengthVolumeBuckets(
  userId: string,
  from: Date | null,
  timeZone: string,
  bucket: "day" | "week",
): Promise<VolumeBucket[]> {
  const keyExpr =
    bucket === "week"
      ? sql<string>`to_char(date_trunc('week', ${schema.workouts.startedAt} AT TIME ZONE ${timeZone}), 'YYYY-MM-DD')`
      : sql<string>`to_char(${schema.workouts.startedAt} AT TIME ZONE ${timeZone}, 'YYYY-MM-DD')`;

  const rows = await db
    .select({
      key: keyExpr,
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
    // Ordinal-группировка (бакет в TZ юзера = колонка 1): bound-параметр TZ
    // нельзя повторять в GROUP BY ($1 vs $N не равны) → ordinal надёжнее.
    .groupBy(sql`1`);

  return rows.map((r) => ({
    key: r.key,
    volume: Number(r.volume),
    sets: Number(r.sets),
    reps: Number(r.reps),
  }));
}

/** Объём круговых по бакету (день/неделя) в TZ юзера: каждый невыполненный-
 *  пропуск раунд завершённой circuit-сессии. Тоннаж = actualWeightKg·actualReps
 *  (bodyweight → 0), подходы = COUNT раундов, повторы = SUM(actualReps). Бакетит
 *  и фильтрует по circuitRoundLogs.completedAt (как muscleHeatProfile) — один
 *  скан по логам без muscle-join, подход не задваивается. */
async function circuitVolumeBuckets(
  userId: string,
  from: Date | null,
  timeZone: string,
  bucket: "day" | "week",
): Promise<VolumeBucket[]> {
  const keyExpr =
    bucket === "week"
      ? sql<string>`to_char(date_trunc('week', ${schema.circuitRoundLogs.completedAt} AT TIME ZONE ${timeZone}), 'YYYY-MM-DD')`
      : sql<string>`to_char(${schema.circuitRoundLogs.completedAt} AT TIME ZONE ${timeZone}, 'YYYY-MM-DD')`;

  const rows = await db
    .select({
      key: keyExpr,
      volume: sql<number>`COALESCE(SUM(${schema.circuitRoundLogs.actualWeightKg} * ${schema.circuitRoundLogs.actualReps}), 0)`,
      sets: sql<number>`COUNT(${schema.circuitRoundLogs.id})`,
      reps: sql<number>`COALESCE(SUM(${schema.circuitRoundLogs.actualReps}), 0)`,
    })
    .from(schema.circuitRoundLogs)
    .innerJoin(
      schema.circuitWorkouts,
      eq(schema.circuitWorkouts.id, schema.circuitRoundLogs.circuitWorkoutId),
    )
    .where(
      and(
        eq(schema.circuitWorkouts.userId, userId),
        eq(schema.circuitWorkouts.status, "completed"),
        eq(schema.circuitRoundLogs.skipped, false),
        from ? gte(schema.circuitRoundLogs.completedAt, from) : undefined,
      ),
    )
    .groupBy(sql`1`);

  return rows.map((r) => ({
    key: r.key,
    volume: Number(r.volume),
    sets: Number(r.sets),
    reps: Number(r.reps),
  }));
}

/** Объём доп. активности (быстрый лог вне тренировок) по бакету (день/неделя)
 *  в TZ юзера. Подход = запись mode='sets'; запись mode='total' считается одним
 *  «подходом»-записью, повторы — как есть. Тоннаж = вес·повторы (вес NULL —
 *  bodyweight/эспандер → 0, честно: тоннаж ≠ усилие). */
async function quickVolumeBuckets(
  userId: string,
  from: Date | null,
  timeZone: string,
  bucket: "day" | "week",
): Promise<VolumeBucket[]> {
  const keyExpr =
    bucket === "week"
      ? sql<string>`to_char(date_trunc('week', ${schema.quickActivities.performedAt} AT TIME ZONE ${timeZone}), 'YYYY-MM-DD')`
      : sql<string>`to_char(${schema.quickActivities.performedAt} AT TIME ZONE ${timeZone}, 'YYYY-MM-DD')`;

  const rows = await db
    .select({
      key: keyExpr,
      volume: sql<number>`COALESCE(SUM(COALESCE(${schema.quickActivities.weightKg}, 0) * ${schema.quickActivities.reps}), 0)`,
      sets: sql<number>`COUNT(${schema.quickActivities.id})`,
      reps: sql<number>`COALESCE(SUM(${schema.quickActivities.reps}), 0)`,
    })
    .from(schema.quickActivities)
    .where(
      and(
        eq(schema.quickActivities.userId, userId),
        from ? gte(schema.quickActivities.performedAt, from) : undefined,
      ),
    )
    .groupBy(sql`1`);

  return rows.map((r) => ({
    key: r.key,
    volume: Number(r.volume),
    sets: Number(r.sets),
    reps: Number(r.reps),
  }));
}

/** Объём по дням за период — силовые working-подходы, круговые раунды И
 *  доп. активность, слитые по дню (`mergeVolumeBuckets`). Дни бакетятся в
 *  `timeZone` юзера — РОВНО как история `/workouts` (G1). Раньше круговая
 *  тренировка не давала столбика на графике объёма (и на week-strip дашборда). */
export async function dailyVolume(
  userId: string,
  range: StatsRange,
  timeZone: string,
): Promise<DailyVolumePoint[]> {
  const from = rangeToFromDate(range);

  const [strength, circuit, quick] = await Promise.all([
    strengthVolumeBuckets(userId, from, timeZone, "day"),
    circuitVolumeBuckets(userId, from, timeZone, "day"),
    quickVolumeBuckets(userId, from, timeZone, "day"),
  ]);

  return mergeVolumeBuckets([strength, circuit, quick]).map((b) => ({
    date: b.key,
    volume: b.volume,
    sets: b.sets,
    reps: b.reps,
  }));
}

export type WeeklyVolumePoint = {
  weekStart: string; // YYYY-MM-DD понедельника
  volume: number;
  sets: number;
  reps: number;
};

/** Объём по неделям (ISO неделя, начало — понедельник) — силовые, круговые И
 *  доп. активность, слитые по неделе. Границы недели — в `timeZone` юзера (G1). */
export async function weeklyVolume(
  userId: string,
  range: StatsRange,
  timeZone: string,
): Promise<WeeklyVolumePoint[]> {
  const from = rangeToFromDate(range);

  const [strength, circuit, quick] = await Promise.all([
    strengthVolumeBuckets(userId, from, timeZone, "week"),
    circuitVolumeBuckets(userId, from, timeZone, "week"),
    quickVolumeBuckets(userId, from, timeZone, "week"),
  ]);

  return mergeVolumeBuckets([strength, circuit, quick]).map((b) => ({
    weekStart: b.key,
    volume: b.volume,
    sets: b.sets,
    reps: b.reps,
  }));
}

export type MuscleVolumePoint = {
  muscleKey: string;
  volume: number;
};

/** Тоннаж группы мышц по роли из одного формата за окно. Силовые и круговые
 *  возвращают одинаковые строки {группа, роль, тоннаж}, чтобы свернуться вместе
 *  `foldMuscleVolume`. */
async function muscleVolumeRows(
  userId: string,
  from: Date | null,
): Promise<MuscleVolumeRow[]> {
  const strength = await db
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

  // Круговые: тоннаж раундов (вес·повторы) по группе×роли. Bodyweight (вес NULL)
  // даёт 0 тоннажа — в объёме по группам не виден (это метрика тоннажа, не
  // усилия; усилие живёт в нагреве аватара). Окно/фильтр по completedAt.
  const circuit = await db
    .select({
      muscle: schema.exerciseMuscleGroups.muscleGroupKey,
      role: schema.exerciseMuscleGroups.role,
      volume: sql<number>`COALESCE(SUM(${schema.circuitRoundLogs.actualWeightKg} * ${schema.circuitRoundLogs.actualReps}), 0)`,
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
        from ? gte(schema.circuitRoundLogs.completedAt, from) : undefined,
      ),
    )
    .groupBy(
      schema.exerciseMuscleGroups.muscleGroupKey,
      schema.exerciseMuscleGroups.role,
    );

  // Доп. активность: тоннаж записей (вес·повторы) по группе×роли. Без веса →
  // 0 тоннажа (метрика тоннажа; усилие живёт в нагреве аватара). Окно — по
  // performedAt.
  const quick = await db
    .select({
      muscle: schema.exerciseMuscleGroups.muscleGroupKey,
      role: schema.exerciseMuscleGroups.role,
      volume: sql<number>`COALESCE(SUM(COALESCE(${schema.quickActivities.weightKg}, 0) * ${schema.quickActivities.reps}), 0)`,
    })
    .from(schema.quickActivities)
    .innerJoin(
      schema.exerciseMuscleGroups,
      eq(
        schema.exerciseMuscleGroups.exerciseId,
        schema.quickActivities.exerciseId,
      ),
    )
    .where(
      and(
        eq(schema.quickActivities.userId, userId),
        from ? gte(schema.quickActivities.performedAt, from) : undefined,
      ),
    )
    .groupBy(
      schema.exerciseMuscleGroups.muscleGroupKey,
      schema.exerciseMuscleGroups.role,
    );

  return [...strength, ...circuit, ...quick].map((r) => ({
    muscleKey: r.muscle,
    role: r.role,
    volume: Number(r.volume),
  }));
}

/** Объём по группам мышц (primary 1.0 / secondary 0.5) — силовые, круговые И
 *  доп. активность тоннажем, свёрнутые `foldMuscleVolume`. */
export async function volumeByMuscle(
  userId: string,
  range: StatsRange,
): Promise<MuscleVolumePoint[]> {
  const rows = await muscleVolumeRows(userId, rangeToFromDate(range));
  return foldMuscleVolume(rows);
}

/** Тоннаж каждой группы мышц по последним `weeks` ISO-неделям (H17.1 «нагрев по
 *  неделям» — тело→время в панели мышцы). Силовые working-сеты И круговые
 *  раунды с role-fold (primary 1.0 / secondary 0.5) — та же семантика и
 *  источник, что `volumeByMuscle`. Бакетит чистой `weeklyVolumeSeries` (срез
 *  пустых краёв). Группы без истории в Map отсутствуют → datum получает []. */
export async function muscleWeeklyVolume(
  userId: string,
  now: Date,
  timeZone: string,
  weeks: number,
): Promise<Map<string, number[]>> {
  // Окно с запасом ±2 дня — точную принадлежность недели решает чистая функция
  // по TZ-границе; запрос лишь грубо отсекает старое.
  const from = new Date(now.getTime() - (weeks * 7 + 2) * DAY_MS);

  const [strengthRows, circuitRows, quickRows] = await Promise.all([
    db
      .select({
        muscle: schema.exerciseMuscleGroups.muscleGroupKey,
        role: schema.exerciseMuscleGroups.role,
        weight: schema.workoutSets.weightKg,
        reps: schema.workoutSets.reps,
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
      .where(
        and(
          eq(schema.workouts.userId, userId),
          eq(schema.workouts.status, "completed"),
          eq(schema.workoutSets.setType, "working"),
          gte(schema.workouts.startedAt, from),
        ),
      ),
    db
      .select({
        muscle: schema.exerciseMuscleGroups.muscleGroupKey,
        role: schema.exerciseMuscleGroups.role,
        weight: schema.circuitRoundLogs.actualWeightKg,
        reps: schema.circuitRoundLogs.actualReps,
        at: schema.circuitRoundLogs.completedAt,
      })
      .from(schema.circuitRoundLogs)
      .innerJoin(
        schema.circuitExercises,
        eq(
          schema.circuitExercises.id,
          schema.circuitRoundLogs.circuitExerciseId,
        ),
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
          gte(schema.circuitRoundLogs.completedAt, from),
        ),
      ),
    db
      .select({
        muscle: schema.exerciseMuscleGroups.muscleGroupKey,
        role: schema.exerciseMuscleGroups.role,
        weight: schema.quickActivities.weightKg,
        reps: schema.quickActivities.reps,
        at: schema.quickActivities.performedAt,
      })
      .from(schema.quickActivities)
      .innerJoin(
        schema.exerciseMuscleGroups,
        eq(
          schema.exerciseMuscleGroups.exerciseId,
          schema.quickActivities.exerciseId,
        ),
      )
      .where(
        and(
          eq(schema.quickActivities.userId, userId),
          gte(schema.quickActivities.performedAt, from),
        ),
      ),
  ]);

  const byMuscle = new Map<string, WeeklyVolumeContribution[]>();
  for (const r of [...strengthRows, ...circuitRows, ...quickRows]) {
    if (r.weight == null || r.reps == null) continue;
    const list = byMuscle.get(r.muscle) ?? [];
    list.push({ at: r.at, volume: r.weight * r.reps * roleFactor(r.role) });
    byMuscle.set(r.muscle, list);
  }

  const out = new Map<string, number[]>();
  for (const [muscle, contribs] of byMuscle) {
    const series = weeklyVolumeSeries(contribs, now, timeZone, weeks);
    if (series.length > 0) out.set(muscle, series);
  }
  return out;
}

/** Распределение выполненных подходов по rep-диапазонам — power/hypertrophy/
 *  endurance split. Силовые working-сеты И круговые reps-раунды (duration-
 *  раунды без повторов исключены). Бакетинг — чистый `distributeRepRanges`. */
export async function repRangeDistribution(
  userId: string,
  range: StatsRange,
): Promise<RepRangePoint[]> {
  const from = rangeToFromDate(range);

  const [strengthRows, circuitRows] = await Promise.all([
    db
      .select({ reps: schema.workoutSets.reps })
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
      ),
    db
      .select({ reps: schema.circuitRoundLogs.actualReps })
      .from(schema.circuitRoundLogs)
      .innerJoin(
        schema.circuitWorkouts,
        eq(schema.circuitWorkouts.id, schema.circuitRoundLogs.circuitWorkoutId),
      )
      .where(
        and(
          eq(schema.circuitWorkouts.userId, userId),
          eq(schema.circuitWorkouts.status, "completed"),
          eq(schema.circuitRoundLogs.skipped, false),
          from ? gte(schema.circuitRoundLogs.completedAt, from) : undefined,
        ),
      ),
  ]);

  const reps = [
    ...strengthRows.map((r) => r.reps),
    ...circuitRows.map((r) => r.reps),
  ].filter((n): n is number => n != null);

  return distributeRepRanges(reps);
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

/** Посуточный счётчик completed-сессий одного формата (один табличный
 *  источник) в TZ юзера. Общий бакет-ключ ('YYYY-MM-DD' в TZ) у всех трёх
 *  форматов — потому их потом можно слить `mergeDailyFrequency`. */
async function dailyCompletedCounts(
  table: PgTable,
  userIdCol: PgColumn,
  statusCol: PgColumn,
  startedAtCol: PgColumn,
  userId: string,
  from: Date | null,
  timeZone: string,
): Promise<FrequencyPoint[]> {
  const rows = await db
    .select({
      date: sql<string>`to_char(${startedAtCol} AT TIME ZONE ${timeZone}, 'YYYY-MM-DD')`,
      count: sql<number>`COUNT(*)`,
    })
    .from(table)
    .where(
      and(
        eq(userIdCol, userId),
        eq(statusCol, "completed"),
        from ? gte(startedAtCol, from) : undefined,
      ),
    )
    // Ordinal-группировка (день в TZ юзера = колонка 1): bound-параметр TZ
    // нельзя повторять в GROUP BY (см. dailyVolume).
    .groupBy(sql`1`);

  return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
}

/** Дни с доп. активностью (быстрый лог вне тренировок) как календарные точки:
 *  день с ЛЮБЫМ числом записей = count 1 (5 подходов у турника ≠ 5 тренировок —
 *  день просто «активен» на heatmap, без инфляции счётчика сессий). */
async function quickDailyPresence(
  userId: string,
  from: Date | null,
  timeZone: string,
): Promise<FrequencyPoint[]> {
  const rows = await db
    .select({
      date: sql<string>`to_char(${schema.quickActivities.performedAt} AT TIME ZONE ${timeZone}, 'YYYY-MM-DD')`,
    })
    .from(schema.quickActivities)
    .where(
      and(
        eq(schema.quickActivities.userId, userId),
        from ? gte(schema.quickActivities.performedAt, from) : undefined,
      ),
    )
    .groupBy(sql`1`);

  return rows.map((r) => ({ date: r.date, count: 1 }));
}

/** Календарная активность — сколько тренировок в каждый день (для
 *  heatmap-графика). Считает ВСЕ форматы: силовые + круговые + кардио (как
 *  счётчик WeekCard дашборда после H12.0 — день с любой тренировкой виден) +
 *  дни доп. активности (count 1 — день с быстрым логом тоже виден).
 *  Дни — в timezone юзера (G1, как `/workouts`). */
export async function workoutFrequency(
  userId: string,
  range: StatsRange,
  timeZone: string,
): Promise<FrequencyPoint[]> {
  const from = rangeToFromDate(range);

  const [strength, circuit, cardio, quick] = await Promise.all([
    dailyCompletedCounts(
      schema.workouts,
      schema.workouts.userId,
      schema.workouts.status,
      schema.workouts.startedAt,
      userId,
      from,
      timeZone,
    ),
    dailyCompletedCounts(
      schema.circuitWorkouts,
      schema.circuitWorkouts.userId,
      schema.circuitWorkouts.status,
      schema.circuitWorkouts.startedAt,
      userId,
      from,
      timeZone,
    ),
    dailyCompletedCounts(
      schema.cardioWorkouts,
      schema.cardioWorkouts.userId,
      schema.cardioWorkouts.status,
      schema.cardioWorkouts.startedAt,
      userId,
      from,
      timeZone,
    ),
    quickDailyPresence(userId, from, timeZone),
  ]);

  return mergeDailyFrequency([strength, circuit, cardio, quick]);
}

export type TopLineKpi = {
  workouts: number;
  totalSets: number;
  totalReps: number;
  totalTonnageKg: number;
};

/** Число completed-сессий одного формата (по своей таблице) в окне периода. */
async function countCompletedSessions(
  table: PgTable,
  userIdCol: PgColumn,
  statusCol: PgColumn,
  startedAtCol: PgColumn,
  userId: string,
  from: Date | null,
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(table)
    .where(
      and(
        eq(userIdCol, userId),
        eq(statusCol, "completed"),
        from ? gte(startedAtCol, from) : undefined,
      ),
    );
  return Number(row?.count ?? 0);
}

/** Вклад круговых тренировок в KPI-итоги за окно периода: каждый невыполненный-
 *  пропуск раунд (circuit_round_logs.skipped=false завершённой circuit-сессии) =
 *  один подход. Повторы = actualReps (duration-раунд без повторов → 0); тоннаж =
 *  actualWeightKg·actualReps там где есть вес (bodyweight → 0). Окно — по
 *  circuitWorkouts.startedAt (паритет с `countCompletedSessions`). Один скан по
 *  логам без muscle-join → подход не задваивается по группам мышц. */
async function circuitEffortTotals(
  userId: string,
  from: Date | null,
): Promise<ActivityTotals> {
  const [agg] = await db
    .select({
      sets: sql<number>`COUNT(${schema.circuitRoundLogs.id})`,
      reps: sql<number>`COALESCE(SUM(${schema.circuitRoundLogs.actualReps}), 0)`,
      tonnage: sql<number>`COALESCE(SUM(${schema.circuitRoundLogs.actualWeightKg} * ${schema.circuitRoundLogs.actualReps}), 0)`,
    })
    .from(schema.circuitRoundLogs)
    .innerJoin(
      schema.circuitWorkouts,
      eq(schema.circuitWorkouts.id, schema.circuitRoundLogs.circuitWorkoutId),
    )
    .where(
      and(
        eq(schema.circuitWorkouts.userId, userId),
        eq(schema.circuitWorkouts.status, "completed"),
        eq(schema.circuitRoundLogs.skipped, false),
        from ? gte(schema.circuitWorkouts.startedAt, from) : undefined,
      ),
    );

  return {
    sets: Number(agg?.sets ?? 0),
    reps: Number(agg?.reps ?? 0),
    tonnageKg: Number(agg?.tonnage ?? 0),
  };
}

/** Вклад доп. активности (быстрый лог вне тренировок) в KPI-итоги за окно:
 *  запись mode='sets' = один подход; mode='total' = одна запись (повторы как
 *  есть). Тоннаж = вес·повторы там, где вес указан (без веса → 0, как
 *  bodyweight-раунды круговых). */
async function quickEffortTotals(
  userId: string,
  from: Date | null,
): Promise<ActivityTotals> {
  const [agg] = await db
    .select({
      sets: sql<number>`COUNT(${schema.quickActivities.id})`,
      reps: sql<number>`COALESCE(SUM(${schema.quickActivities.reps}), 0)`,
      tonnage: sql<number>`COALESCE(SUM(COALESCE(${schema.quickActivities.weightKg}, 0) * ${schema.quickActivities.reps}), 0)`,
    })
    .from(schema.quickActivities)
    .where(
      and(
        eq(schema.quickActivities.userId, userId),
        from ? gte(schema.quickActivities.performedAt, from) : undefined,
      ),
    );

  return {
    sets: Number(agg?.sets ?? 0),
    reps: Number(agg?.reps ?? 0),
    tonnageKg: Number(agg?.tonnage ?? 0),
  };
}

/** Главные KPI-карточки на /stats. Учитывает ВСЮ активность: «Тренировок»
 *  считает все форматы (силовые + круговые + кардио), а Подходы/Повторения/
 *  Тоннаж складывают силовые рабочие подходы, круговые раунды И доп. активность
 *  (`combineActivityTotals`) — раньше круговая тренировка давала противоречивую
 *  карточку «N тренировок / 0 подходов». Кардио в подходы/тоннаж не входит (нет
 *  подходов/веса) — оно учтено как сессия в «Тренировок». Доп. активность в
 *  «Тренировок» НЕ входит (запись ≠ сессия), но входит в подходы/повторы. */
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

  const [circuitCount, cardioCount, circuitEffort, quickEffort] =
    await Promise.all([
    countCompletedSessions(
      schema.circuitWorkouts,
      schema.circuitWorkouts.userId,
      schema.circuitWorkouts.status,
      schema.circuitWorkouts.startedAt,
      userId,
      from,
    ),
    countCompletedSessions(
      schema.cardioWorkouts,
      schema.cardioWorkouts.userId,
      schema.cardioWorkouts.status,
      schema.cardioWorkouts.startedAt,
      userId,
      from,
    ),
    circuitEffortTotals(userId, from),
    quickEffortTotals(userId, from),
  ]);

  const totals = combineActivityTotals([
    {
      sets: Number(agg?.sets ?? 0),
      reps: Number(agg?.reps ?? 0),
      tonnageKg: Number(agg?.tonnage ?? 0),
    },
    circuitEffort,
    quickEffort,
  ]);

  return {
    workouts: Number(agg?.workouts ?? 0) + circuitCount + cardioCount,
    totalSets: totals.sets,
    totalReps: totals.reps,
    totalTonnageKg: totals.tonnageKg,
  };
}

export type PeriodVolumeComparison = {
  /** Тоннаж всех форматов (силовые + круговые) за текущее окно периода. */
  current: number;
  /** Тоннаж всех форматов за предыдущее окно той же длины, или null если
   *  сравнить не с чем (range='all' — нет ограниченного прошлого окна). */
  previous: number | null;
};

/** Тоннаж активности (вес × повторы) за окно [from, to) — силовые working
 *  подходы И круговые раунды (паритет с KPI «Тоннаж» и графиком объёма). Только
 *  completed-сессии (G1). `from`/`to` null → без соответствующей границы. Так
 *  вывод «растёшь/падаешь» не врёт круговому атлету, что объём «упал до нуля». */
async function activityTonnage(
  userId: string,
  from: Date | null,
  to: Date | null,
): Promise<number> {
  const [strength, circuit, quick] = await Promise.all([
    db
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
      ),
    db
      .select({
        tonnage: sql<number>`COALESCE(SUM(${schema.circuitRoundLogs.actualWeightKg} * ${schema.circuitRoundLogs.actualReps}), 0)`,
      })
      .from(schema.circuitRoundLogs)
      .innerJoin(
        schema.circuitWorkouts,
        eq(schema.circuitWorkouts.id, schema.circuitRoundLogs.circuitWorkoutId),
      )
      .where(
        and(
          eq(schema.circuitWorkouts.userId, userId),
          eq(schema.circuitWorkouts.status, "completed"),
          eq(schema.circuitRoundLogs.skipped, false),
          from ? gte(schema.circuitWorkouts.startedAt, from) : undefined,
          to ? lt(schema.circuitWorkouts.startedAt, to) : undefined,
        ),
      ),
    db
      .select({
        tonnage: sql<number>`COALESCE(SUM(COALESCE(${schema.quickActivities.weightKg}, 0) * ${schema.quickActivities.reps}), 0)`,
      })
      .from(schema.quickActivities)
      .where(
        and(
          eq(schema.quickActivities.userId, userId),
          from ? gte(schema.quickActivities.performedAt, from) : undefined,
          to ? lt(schema.quickActivities.performedAt, to) : undefined,
        ),
      ),
  ]);

  return (
    Number(strength[0]?.tonnage ?? 0) +
    Number(circuit[0]?.tonnage ?? 0) +
    Number(quick[0]?.tonnage ?? 0)
  );
}

/** Сравнение внешней нагрузки текущего периода с предыдущим окном той же
 *  длины. Тоннаж включает силовые, круговые и доп. активность — как KPI и
 *  график. Само изменение тоннажа не интерпретируется как прогресс. */
export async function periodVolumeComparison(
  userId: string,
  range: StatsRange,
): Promise<PeriodVolumeComparison> {
  const from = rangeToFromDate(range);

  // range='all' → окно неограниченно, сравнивать не с чем.
  if (!from) {
    const current = await activityTonnage(userId, null, null);
    return { current, previous: null };
  }

  const lengthMs = Date.now() - from.getTime();
  const prevFrom = new Date(from.getTime() - lengthMs);

  const [current, previous] = await Promise.all([
    activityTonnage(userId, from, null),
    activityTonnage(userId, prevFrom, from),
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
 *  доменный `heatFromSets`): серый → красный. Считает силовые подходы, круговые
 *  (circuit_round_logs) И доп. активность (quick_activities) — иначе круговая
 *  тренировка или подходы «между делом» не «грели» бы тело (баг: пользователь
 *  подтягивался у турника, а аватар оставался серым). Силовые/круговые — только
 *  completed-сессии (G1); доп. активность — все записи (лог сразу финален).
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

  // Доп. активность: каждая запись = один «подход» своего упражнения (mode=
  // 'sets' — буквально подход; mode='total' — одна суммарная запись, считаем
  // одним эффективным подходом: лёгкая внетренировочная нагрузка без инфляции
  // нагрева). Вес/повторы — для тоннажа, где вес указан.
  const quickHeatRows = await db
    .select({
      entryId: schema.quickActivities.id,
      muscle: schema.exerciseMuscleGroups.muscleGroupKey,
      role: schema.exerciseMuscleGroups.role,
      weight: schema.quickActivities.weightKg,
      reps: schema.quickActivities.reps,
      exerciseId: schema.quickActivities.exerciseId,
      exName: schema.exercises.nameRu,
      at: schema.quickActivities.performedAt,
    })
    .from(schema.quickActivities)
    .innerJoin(
      schema.exerciseMuscleGroups,
      eq(
        schema.exerciseMuscleGroups.exerciseId,
        schema.quickActivities.exerciseId,
      ),
    )
    .innerJoin(
      schema.exercises,
      eq(schema.exercises.id, schema.quickActivities.exerciseId),
    )
    .where(
      and(
        eq(schema.quickActivities.userId, userId),
        gte(schema.quickActivities.performedAt, from),
      ),
    );

  const rows: HeatRow[] = [
    ...strengthRows.map((r) => ({ ...r, sourceId: `s:${r.setId}` })),
    ...circuitRows.map((r) => ({ ...r, sourceId: `c:${r.logId}` })),
    ...quickHeatRows.map((r) => ({ ...r, sourceId: `q:${r.entryId}` })),
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

  const quick = await db
    .select({
      muscle: schema.exerciseMuscleGroups.muscleGroupKey,
      at: sql<Date>`max(${schema.quickActivities.performedAt})`.as("at"),
    })
    .from(schema.quickActivities)
    .innerJoin(
      schema.exerciseMuscleGroups,
      eq(
        schema.exerciseMuscleGroups.exerciseId,
        schema.quickActivities.exerciseId,
      ),
    )
    .where(eq(schema.quickActivities.userId, userId))
    .groupBy(schema.exerciseMuscleGroups.muscleGroupKey);

  const map = new Map<string, Date>();
  for (const r of [...strength, ...circuit, ...quick]) {
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

/** Лучший рабочий сет упражнения в окне (по e1RM) + e1RM. */
type BestSet = { weightKg: number; reps: number; e1rm: number };

/** H11.1c — «ключевые движения недели»: топ-3 упражнения этой ISO-недели по
 *  |Δe1RM| против их лучшего за всю историю ДО неё (+ флаг недельного PR).
 *  Один скан рабочих сетов completed-сессий: bucket недели (TZ-корректный
 *  date_trunc, как weeklyReviewData) делит «эта неделя» (==weekStart) и «всё до»
 *  (bucket < weekStart — YYYY-MM-DD понедельники сравнимы лексикографически).
 *  Только working-сеты с весом и повторами >0 (тоннаж-семантика /stats; bodyweight
 *  без добавки не попадает в e1RM-сравнение). Отбор топ-3 — чистый
 *  `selectKeyMovements` (R-7). Пусто (нет силовых этой недели) → []. */
export async function weeklyKeyMovements(
  userId: string,
  now: Date,
  timeZone: string,
): Promise<WeeklyKeyMovement[]> {
  const weekStart = isoWeekStartIso(now, timeZone);
  const weekExpr = sql<string>`to_char(date_trunc('week', ${schema.workouts.startedAt} AT TIME ZONE ${timeZone}), 'YYYY-MM-DD')`;

  const rows = await db
    .select({
      exerciseId: schema.workoutExercises.exerciseId,
      nameRu: schema.exercises.nameRu,
      nameEn: schema.exercises.nameEn,
      weight: schema.workoutSets.weightKg,
      reps: schema.workoutSets.reps,
      week: weekExpr,
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
      ),
    );

  type Names = { nameRu: string; nameEn: string };
  const names = new Map<string, Names>();
  const curBest = new Map<string, BestSet>();
  const priorBest = new Map<string, BestSet>();

  for (const r of rows) {
    const weight = Number(r.weight);
    const reps = Number(r.reps);
    if (!(weight > 0) || !(reps > 0)) continue;
    const e1rm = estimatedOneRepMax(weight, reps);
    if (e1rm <= 0) continue;
    names.set(r.exerciseId, { nameRu: r.nameRu, nameEn: r.nameEn });
    const bucket = r.week === weekStart ? curBest : r.week < weekStart ? priorBest : null;
    if (!bucket) continue; // будущая неделя (TZ-граница) — игнор
    const cur = bucket.get(r.exerciseId);
    if (!cur || e1rm > cur.e1rm) {
      bucket.set(r.exerciseId, { weightKg: weight, reps, e1rm });
    }
  }

  const candidates: WeeklyKeyMovement[] = [];
  for (const [exerciseId, cur] of curBest) {
    const prev = priorBest.get(exerciseId) ?? null;
    const name = names.get(exerciseId)!;
    candidates.push({
      exerciseId,
      nameRu: name.nameRu,
      nameEn: name.nameEn,
      curTopSet: { weightKg: cur.weightKg, reps: cur.reps },
      prevTopSet: prev ? { weightKg: prev.weightKg, reps: prev.reps } : null,
      curE1rm: cur.e1rm,
      prevE1rm: prev ? prev.e1rm : null,
      deltaE1rm: prev ? cur.e1rm - prev.e1rm : null,
      isPr: prev ? cur.e1rm > prev.e1rm : false,
    });
  }

  return selectKeyMovements(candidates);
}

/** Агрегаты одной ISO-недели для недельного разбора тренера (H8.1). */
export type WeeklyAgg = {
  sessions: number;
  tonnage: number;
  sets: number;
  muscleVolumes: { muscleKey: string; volume: number }[];
  /** Круговые completed-сессии недели. */
  circuitSessions: number;
  /** Невыполненные-пропуск раунды круговых недели (раунд = подход). */
  circuitRounds: number;
  /** Тоннаж круговых раундов недели (вес×повт; bodyweight → 0). */
  circuitTonnage: number;
  /** Кардио completed-сессии недели. */
  cardioSessions: number;
  /** Активные work-минуты кардио недели. */
  cardioMinutes: number;
  /** Записи доп. активности недели (быстрый лог вне тренировок). */
  quickEntries: number;
  /** Суммарные повторы доп. активности недели. */
  quickReps: number;
  /** Тоннаж доп. активности (вес×повт; без веса → 0). */
  quickTonnage: number;
  /** Разбивка доп. активности по упражнениям×режиму для промпта тренера:
   *  обычные подходы, тотал и отдельные Myo-reps кластеры. */
  quickByExercise: {
    name: string;
    mode: "sets" | "total" | "myo_reps";
    entries: number;
    reps: number;
  }[];
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
  /** Топ-3 движения недели по |Δe1RM| (H11.1c) — тренер называет упражнения,
   *  а не только тоннаж. Пусто → блок опущен, exerciseComparisons=[]. */
  keyMovements: WeeklyKeyMovement[];
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

  // (C) Круговые: сессии + раунды + тоннаж по неделям (бакет по
  //     circuitWorkouts.startedAt). Тренер видит круговые недели.
  const circuitWeekExpr = sql<string>`to_char(date_trunc('week', ${schema.circuitWorkouts.startedAt} AT TIME ZONE ${timeZone}), 'YYYY-MM-DD')`;
  const circuitRows = await db
    .select({
      week: circuitWeekExpr,
      sessions: sql<number>`COUNT(DISTINCT ${schema.circuitWorkouts.id})`,
      rounds: sql<number>`COUNT(${schema.circuitRoundLogs.id})`,
      tonnage: sql<number>`COALESCE(SUM(${schema.circuitRoundLogs.actualWeightKg} * ${schema.circuitRoundLogs.actualReps}), 0)`,
    })
    .from(schema.circuitWorkouts)
    .leftJoin(
      schema.circuitRoundLogs,
      and(
        eq(schema.circuitRoundLogs.circuitWorkoutId, schema.circuitWorkouts.id),
        eq(schema.circuitRoundLogs.skipped, false),
      ),
    )
    .where(
      and(
        eq(schema.circuitWorkouts.userId, userId),
        eq(schema.circuitWorkouts.status, "completed"),
        gte(schema.circuitWorkouts.startedAt, from),
      ),
    )
    .groupBy(sql`1`);

  // (D) Кардио: сессии + активные work-минуты по неделям (бакет по
  //     cardioWorkouts.startedAt). work-блоки несут реальное время нагрузки.
  const cardioWeekExpr = sql<string>`to_char(date_trunc('week', ${schema.cardioWorkouts.startedAt} AT TIME ZONE ${timeZone}), 'YYYY-MM-DD')`;
  const cardioRows = await db
    .select({
      week: cardioWeekExpr,
      sessions: sql<number>`COUNT(DISTINCT ${schema.cardioWorkouts.id})`,
      seconds: sql<number>`COALESCE(SUM(${schema.cardioBlocks.actualDurationSec}) FILTER (WHERE ${schema.cardioBlocks.kind} = 'work'), 0)`,
    })
    .from(schema.cardioWorkouts)
    .leftJoin(
      schema.cardioBlocks,
      eq(schema.cardioBlocks.cardioWorkoutId, schema.cardioWorkouts.id),
    )
    .where(
      and(
        eq(schema.cardioWorkouts.userId, userId),
        eq(schema.cardioWorkouts.status, "completed"),
        gte(schema.cardioWorkouts.startedAt, from),
      ),
    )
    .groupBy(sql`1`);

  // (E) Доп. активность: записи×повторы×тоннаж по неделе × упражнению × режиму
  //     (бакет по performedAt). Тренер видит подходы «между делом» — иначе
  //     неделя из подтягиваний у турника выглядела бы пустой.
  const quickWeekExpr = sql<string>`to_char(date_trunc('week', ${schema.quickActivities.performedAt} AT TIME ZONE ${timeZone}), 'YYYY-MM-DD')`;
  const quickWeekRows = await db
    .select({
      week: quickWeekExpr,
      name: schema.exercises.nameRu,
      mode: schema.quickActivities.mode,
      entries: sql<number>`COUNT(${schema.quickActivities.id})`,
      reps: sql<number>`COALESCE(SUM(${schema.quickActivities.reps}), 0)`,
      tonnage: sql<number>`COALESCE(SUM(COALESCE(${schema.quickActivities.weightKg}, 0) * ${schema.quickActivities.reps}), 0)`,
    })
    .from(schema.quickActivities)
    .innerJoin(
      schema.exercises,
      eq(schema.exercises.id, schema.quickActivities.exerciseId),
    )
    .where(
      and(
        eq(schema.quickActivities.userId, userId),
        gte(schema.quickActivities.performedAt, from),
      ),
    )
    .groupBy(sql`1`, schema.exercises.nameRu, schema.quickActivities.mode);

  const buildAgg = (weekKey: string): WeeklyAgg => {
    const t = totalsRows.find((r) => r.week === weekKey);
    const c = circuitRows.find((r) => r.week === weekKey);
    const cardio = cardioRows.find((r) => r.week === weekKey);
    const quick = quickWeekRows.filter((r) => r.week === weekKey);
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
      circuitSessions: Number(c?.sessions ?? 0),
      circuitRounds: Number(c?.rounds ?? 0),
      circuitTonnage: Number(c?.tonnage ?? 0),
      cardioSessions: Number(cardio?.sessions ?? 0),
      cardioMinutes: Math.round(Number(cardio?.seconds ?? 0) / 60),
      quickEntries: quick.reduce((s, r) => s + Number(r.entries), 0),
      quickReps: quick.reduce((s, r) => s + Number(r.reps), 0),
      quickTonnage: quick.reduce((s, r) => s + Number(r.tonnage), 0),
      quickByExercise: quick
        .map((r) => ({
          name: r.name,
          mode: r.mode,
          entries: Number(r.entries),
          reps: Number(r.reps),
        }))
        .sort((a, b) => b.reps - a.reps),
    };
  };

  const keyMovements = await weeklyKeyMovements(userId, now, timeZone);

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
    keyMovements,
  };
}
