import { and, asc, eq, gte, lt, sql } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { MUSCLE_KEYS } from "@/lib/domain/avatar/heat";
import { estimatedOneRepMax } from "@/lib/domain/progression/one-rep-max";
import { rangeToFromDate, type StatsRange } from "@/lib/domain/stats/range";

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
  /** Working-тоннаж группы за последние 7 дней (primary 1.0 / secondary 0.5). */
  current7dVolume: number;
  /** Средний недельный working-тоннаж группы за baseline-окно (прошлые недели,
   *  БЕЗ текущих 7 дней) — «собственная норма». 0 = нормы нет. */
  baselineWeeklyVolume: number;
  /** Число working-подходов, задевших группу за последние 7 дней. */
  sets: number;
  /** Когда группа в последний раз работала (в пределах baseline-окна). null =
   *  не тренировалась в окне. */
  lastTrainedAt: Date | null;
  /** Топ-3 упражнения по вкладу в группу за последние 7 дней. */
  top3: Array<{ name: string; volume: number }>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Профиль «нагрева» всех 14 групп мышц для 3D-аватара: объём за последние
 *  7 дней + собственная недельная норма (среднее за `baselineWeeks` прошлых
 *  недель, исключая текущие 7 дней) + подходы/последняя тренировка/топ-упражнения
 *  за текущее окно. Только completed + working (G1).
 *
 *  Возвращает РОВНО 14 записей в порядке MUSCLE_KEYS (нетренированные —
 *  нулями), чтобы страница раскрашивала всё тело без доуборки на своей стороне.
 *  Один запрос за окно [baselineStart, now), агрегация в TS — данных мало
 *  (один юзер × ~5 недель подходов). Доменный `distributeVolumeByMuscle`
 *  фиксирует коэффициенты ролей; здесь они применяются построчно, т.к. нужно
 *  ещё окно/подходы/топ на тот же проход. */
export async function muscleHeatProfile(
  userId: string,
  now: Date,
  baselineWeeks = 4,
): Promise<MuscleHeat[]> {
  const currentStart = new Date(now.getTime() - 7 * DAY_MS);
  const baselineStart = new Date(
    now.getTime() - (baselineWeeks + 1) * 7 * DAY_MS,
  );

  const rows = await db
    .select({
      setId: schema.workoutSets.id,
      muscle: schema.exerciseMuscleGroups.muscleGroupKey,
      role: schema.exerciseMuscleGroups.role,
      weight: schema.workoutSets.weightKg,
      reps: schema.workoutSets.reps,
      exerciseId: schema.workoutExercises.exerciseId,
      exName: schema.exercises.nameRu,
      startedAt: schema.workouts.startedAt,
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
        gte(schema.workouts.startedAt, baselineStart),
      ),
    );

  type Acc = {
    current: number;
    baseline: number;
    setIds: Set<string>;
    lastTrainedAt: Date | null;
    exVolume: Map<string, { name: string; volume: number }>;
  };
  const byMuscle = new Map<string, Acc>();
  const ensure = (key: string): Acc => {
    let a = byMuscle.get(key);
    if (!a) {
      a = {
        current: 0,
        baseline: 0,
        setIds: new Set(),
        lastTrainedAt: null,
        exVolume: new Map(),
      };
      byMuscle.set(key, a);
    }
    return a;
  };

  for (const r of rows) {
    const factor = r.role === "primary" ? 1 : 0.5;
    const vol = r.weight * r.reps * factor;
    const acc = ensure(r.muscle);
    const inCurrent = r.startedAt.getTime() >= currentStart.getTime();

    if (inCurrent) {
      acc.current += vol;
      acc.setIds.add(r.setId);
      const ex = acc.exVolume.get(r.exerciseId);
      if (ex) ex.volume += vol;
      else acc.exVolume.set(r.exerciseId, { name: r.exName, volume: vol });
    } else {
      acc.baseline += vol;
    }
    // lastTrainedAt — максимум по всему окну: мышца могла не работать в текущие
    // 7 дней, но «последняя тренировка» всё равно осмысленна для панели.
    if (!acc.lastTrainedAt || r.startedAt > acc.lastTrainedAt) {
      acc.lastTrainedAt = r.startedAt;
    }
  }

  return MUSCLE_KEYS.map((key) => {
    const a = byMuscle.get(key);
    if (!a) {
      return {
        muscleKey: key,
        current7dVolume: 0,
        baselineWeeklyVolume: 0,
        sets: 0,
        lastTrainedAt: null,
        top3: [],
      };
    }
    const top3 = Array.from(a.exVolume.values())
      .sort((x, y) => y.volume - x.volume)
      .slice(0, 3);
    return {
      muscleKey: key,
      current7dVolume: a.current,
      baselineWeeklyVolume: a.baseline / baselineWeeks,
      sets: a.setIds.size,
      lastTrainedAt: a.lastTrainedAt,
      top3,
    };
  });
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
