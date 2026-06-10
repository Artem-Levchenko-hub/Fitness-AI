import { and, asc, eq, gte, sql } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";

export type StatsRange = "7d" | "30d" | "90d" | "365d" | "all";

export function rangeToFromDate(range: StatsRange): Date | null {
  if (range === "all") return null;
  const days = parseInt(range, 10);
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export type DailyVolumePoint = {
  date: string; // YYYY-MM-DD (UTC)
  volume: number;
  sets: number;
  reps: number;
};

/** Объём по дням за период. Учитывает только working подходы. */
export async function dailyVolume(
  userId: string,
  range: StatsRange,
): Promise<DailyVolumePoint[]> {
  const from = rangeToFromDate(range);

  const rows = await db
    .select({
      day: sql<string>`to_char(${schema.workouts.startedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
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
    .groupBy(
      sql`to_char(${schema.workouts.startedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
    )
    .orderBy(
      asc(
        sql`to_char(${schema.workouts.startedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
      ),
    );

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

/** Объём по неделям (ISO неделя, начало — понедельник). */
export async function weeklyVolume(
  userId: string,
  range: StatsRange,
): Promise<WeeklyVolumePoint[]> {
  const from = rangeToFromDate(range);

  const rows = await db
    .select({
      week: sql<string>`to_char(date_trunc('week', ${schema.workouts.startedAt} AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`,
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
    .groupBy(
      sql`date_trunc('week', ${schema.workouts.startedAt} AT TIME ZONE 'UTC')`,
    )
    .orderBy(
      asc(
        sql`date_trunc('week', ${schema.workouts.startedAt} AT TIME ZONE 'UTC')`,
      ),
    );

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
): Promise<OneRmTrendPoint[]> {
  const from = rangeToFromDate(range);

  // Достаём все working-подходы с e1RM по Epley × Brzycki avg
  const rows = await db
    .select({
      date: sql<string>`to_char(${schema.workouts.startedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
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
    if (r.reps < 1) continue;
    const epley = r.weight * (1 + r.reps / 30);
    const brzycki =
      r.reps >= 37 ? 0 : (r.weight * 36) / (37 - r.reps);
    const e1 = r.reps === 1 ? r.weight : (epley + brzycki) / 2;
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
 *  (для heatmap-графика). */
export async function workoutFrequency(
  userId: string,
  range: StatsRange,
): Promise<FrequencyPoint[]> {
  const from = rangeToFromDate(range);

  const rows = await db
    .select({
      date: sql<string>`to_char(${schema.workouts.startedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
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
    .groupBy(
      sql`to_char(${schema.workouts.startedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
    );

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
