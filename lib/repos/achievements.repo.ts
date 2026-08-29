import { and, eq, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  calendarMonthBounds,
  type AchievementFacts,
  type CalendarMonthBounds,
  type MonthlySummary,
} from "@/lib/domain/stats/achievements";

const quickEffectiveSets = sql<number>`CASE
  WHEN ${schema.quickActivities.mode} = 'myo_reps'
    THEN 1 + COALESCE(${schema.quickActivities.myoMiniSets}, 3)
  ELSE 1
END`;

const quickEffectiveReps = sql<number>`CASE
  WHEN ${schema.quickActivities.mode} = 'myo_reps'
    THEN ${schema.quickActivities.reps}
      + COALESCE(${schema.quickActivities.myoMiniSets}, 3)
      * COALESCE(${schema.quickActivities.myoMiniReps}, 5)
  ELSE ${schema.quickActivities.reps}
END`;

const isPullUp = sql<boolean>`${schema.exercises.slug} in (
  'pull-up',
  'chin-up',
  'pull-up-wide',
  'neutral-grip-pull-up',
  'pull-up-weighted',
  'towel-pull-up'
)`;

type SourceTotals = {
  monthSessions: number;
  totalSessions: number;
  monthSets: number;
  monthReps: number;
  monthTonnage: number;
  totalTonnage: number;
  maxSessionTonnage: number;
  monthPullUps: number;
  monthWeightedSquats: number;
  totalPullUps: number;
  benchMax: number;
  squatMax: number;
};

export async function getMonthlyAchievements(
  userId: string,
  timeZone: string,
  now = new Date(),
): Promise<{ monthly: MonthlySummary; facts: AchievementFacts }> {
  const month = calendarMonthBounds(now, timeZone);
  const [strength, circuit, quick, cardio, manual] = await Promise.all([
    strengthTotals(userId, timeZone, month),
    circuitTotals(userId, timeZone, month),
    quickTotals(userId, timeZone, month),
    cardioTotals(userId, timeZone, month),
    manualRecordMaximums(userId),
  ]);

  return {
    monthly: {
      month,
      workouts:
        strength.monthSessions + circuit.monthSessions + cardio.monthSessions,
      totalSets: strength.monthSets + circuit.monthSets + quick.monthSets,
      totalReps: strength.monthReps + circuit.monthReps + quick.monthReps,
      totalTonnageKg:
        strength.monthTonnage + circuit.monthTonnage + quick.monthTonnage,
      pullUpReps:
        strength.monthPullUps + circuit.monthPullUps + quick.monthPullUps,
      weightedSquatReps:
        strength.monthWeightedSquats +
        circuit.monthWeightedSquats +
        quick.monthWeightedSquats,
    },
    facts: {
      workouts:
        strength.totalSessions + circuit.totalSessions + cardio.totalSessions,
      pullUpReps:
        strength.totalPullUps + circuit.totalPullUps + quick.totalPullUps,
      benchPressKg: Math.max(
        strength.benchMax,
        circuit.benchMax,
        quick.benchMax,
        manual.benchMax,
      ),
      backSquatKg: Math.max(
        strength.squatMax,
        circuit.squatMax,
        quick.squatMax,
        manual.squatMax,
      ),
      maxWorkoutTonnageT:
        Math.max(strength.maxSessionTonnage, circuit.maxSessionTonnage) / 1_000,
      totalTonnageT:
        (strength.totalTonnage + circuit.totalTonnage + quick.totalTonnage) /
        1_000,
    },
  };
}

async function strengthTotals(
  userId: string,
  timeZone: string,
  month: CalendarMonthBounds,
): Promise<SourceTotals> {
  const inMonth = localMonthFilter(
    schema.workouts.startedAt,
    timeZone,
    month,
  );
  const [rows, maxSessionTonnage] = await Promise.all([
    db
      .select({
        monthSessions: sql<number>`COUNT(DISTINCT ${schema.workouts.id}) FILTER (WHERE ${inMonth})`,
        totalSessions: sql<number>`COUNT(DISTINCT ${schema.workouts.id})`,
        monthSets: sql<number>`COUNT(${schema.workoutSets.id}) FILTER (WHERE ${inMonth})`,
        monthReps: sql<number>`COALESCE(SUM(${schema.workoutSets.reps}) FILTER (WHERE ${inMonth}), 0)`,
        monthTonnage: sql<number>`COALESCE(SUM(${schema.workoutSets.weightKg} * ${schema.workoutSets.reps}) FILTER (WHERE ${inMonth}), 0)`,
        totalTonnage: sql<number>`COALESCE(SUM(${schema.workoutSets.weightKg} * ${schema.workoutSets.reps}), 0)`,
        monthPullUps: sql<number>`COALESCE(SUM(${schema.workoutSets.reps}) FILTER (WHERE ${inMonth} AND ${isPullUp}), 0)`,
        monthWeightedSquats: sql<number>`COALESCE(SUM(${schema.workoutSets.reps}) FILTER (WHERE ${inMonth} AND ${schema.exercises.slug} = 'back-squat' AND ${schema.workoutSets.weightKg} > 0), 0)`,
        totalPullUps: sql<number>`COALESCE(SUM(${schema.workoutSets.reps}) FILTER (WHERE ${isPullUp}), 0)`,
        benchMax: sql<number>`COALESCE(MAX(${schema.workoutSets.weightKg}) FILTER (WHERE ${schema.exercises.slug} = 'bench-press-barbell'), 0)`,
        squatMax: sql<number>`COALESCE(MAX(${schema.workoutSets.weightKg}) FILTER (WHERE ${schema.exercises.slug} = 'back-squat'), 0)`,
      })
      .from(schema.workouts)
      .leftJoin(
        schema.workoutExercises,
        eq(schema.workoutExercises.workoutId, schema.workouts.id),
      )
      .leftJoin(
        schema.exercises,
        eq(schema.exercises.id, schema.workoutExercises.exerciseId),
      )
      .leftJoin(
        schema.workoutSets,
        and(
          eq(
            schema.workoutSets.workoutExerciseId,
            schema.workoutExercises.id,
          ),
          eq(schema.workoutSets.setType, "working"),
        ),
      )
      .where(
        and(
          eq(schema.workouts.userId, userId),
          eq(schema.workouts.status, "completed"),
        ),
      ),
    strengthMaxSessionTonnage(userId),
  ]);

  return normalizeTotals({ ...rows[0], maxSessionTonnage });
}

async function circuitTotals(
  userId: string,
  timeZone: string,
  month: CalendarMonthBounds,
): Promise<SourceTotals> {
  // Месячные KPI, как topLineKpi, относят всю сессию к месяцу её старта:
  // тренировка и выполненные в ней раунды не расходятся по разным месяцам.
  const inMonth = localMonthFilter(
    schema.circuitWorkouts.startedAt,
    timeZone,
    month,
  );
  const [rows, maxSessionTonnage] = await Promise.all([
    db
      .select({
        monthSessions: sql<number>`COUNT(DISTINCT ${schema.circuitWorkouts.id}) FILTER (WHERE ${inMonth})`,
        totalSessions: sql<number>`COUNT(DISTINCT ${schema.circuitWorkouts.id})`,
        monthSets: sql<number>`COUNT(${schema.circuitRoundLogs.id}) FILTER (WHERE ${inMonth} AND ${schema.circuitRoundLogs.skipped} = false)`,
        monthReps: sql<number>`COALESCE(SUM(${schema.circuitRoundLogs.actualReps}) FILTER (WHERE ${inMonth} AND ${schema.circuitRoundLogs.skipped} = false), 0)`,
        monthTonnage: sql<number>`COALESCE(SUM(${schema.circuitRoundLogs.actualWeightKg} * ${schema.circuitRoundLogs.actualReps}) FILTER (WHERE ${inMonth} AND ${schema.circuitRoundLogs.skipped} = false), 0)`,
        totalTonnage: sql<number>`COALESCE(SUM(${schema.circuitRoundLogs.actualWeightKg} * ${schema.circuitRoundLogs.actualReps}) FILTER (WHERE ${schema.circuitRoundLogs.skipped} = false), 0)`,
        monthPullUps: sql<number>`COALESCE(SUM(${schema.circuitRoundLogs.actualReps}) FILTER (WHERE ${inMonth} AND ${schema.circuitRoundLogs.skipped} = false AND ${isPullUp}), 0)`,
        monthWeightedSquats: sql<number>`COALESCE(SUM(${schema.circuitRoundLogs.actualReps}) FILTER (WHERE ${inMonth} AND ${schema.circuitRoundLogs.skipped} = false AND ${schema.exercises.slug} = 'back-squat' AND ${schema.circuitRoundLogs.actualWeightKg} > 0), 0)`,
        totalPullUps: sql<number>`COALESCE(SUM(${schema.circuitRoundLogs.actualReps}) FILTER (WHERE ${schema.circuitRoundLogs.skipped} = false AND ${isPullUp}), 0)`,
        benchMax: sql<number>`COALESCE(MAX(${schema.circuitRoundLogs.actualWeightKg}) FILTER (WHERE ${schema.circuitRoundLogs.skipped} = false AND ${schema.exercises.slug} = 'bench-press-barbell'), 0)`,
        squatMax: sql<number>`COALESCE(MAX(${schema.circuitRoundLogs.actualWeightKg}) FILTER (WHERE ${schema.circuitRoundLogs.skipped} = false AND ${schema.exercises.slug} = 'back-squat'), 0)`,
      })
      .from(schema.circuitWorkouts)
      .leftJoin(
        schema.circuitExercises,
        eq(
          schema.circuitExercises.circuitWorkoutId,
          schema.circuitWorkouts.id,
        ),
      )
      .leftJoin(
        schema.exercises,
        eq(schema.exercises.id, schema.circuitExercises.exerciseId),
      )
      .leftJoin(
        schema.circuitRoundLogs,
        and(
          eq(
            schema.circuitRoundLogs.circuitExerciseId,
            schema.circuitExercises.id,
          ),
          eq(
            schema.circuitRoundLogs.circuitWorkoutId,
            schema.circuitWorkouts.id,
          ),
        ),
      )
      .where(
        and(
          eq(schema.circuitWorkouts.userId, userId),
          eq(schema.circuitWorkouts.status, "completed"),
        ),
      ),
    circuitMaxSessionTonnage(userId),
  ]);

  return normalizeTotals({ ...rows[0], maxSessionTonnage });
}

async function quickTotals(
  userId: string,
  timeZone: string,
  month: CalendarMonthBounds,
): Promise<SourceTotals> {
  const inMonth = localMonthFilter(
    schema.quickActivities.performedAt,
    timeZone,
    month,
  );
  const [row] = await db
    .select({
      monthSets: sql<number>`COALESCE(SUM(${quickEffectiveSets}) FILTER (WHERE ${inMonth}), 0)`,
      monthReps: sql<number>`COALESCE(SUM(${quickEffectiveReps}) FILTER (WHERE ${inMonth}), 0)`,
      monthTonnage: sql<number>`COALESCE(SUM(COALESCE(${schema.quickActivities.weightKg}, 0) * (${quickEffectiveReps})) FILTER (WHERE ${inMonth}), 0)`,
      totalTonnage: sql<number>`COALESCE(SUM(COALESCE(${schema.quickActivities.weightKg}, 0) * (${quickEffectiveReps})), 0)`,
      monthPullUps: sql<number>`COALESCE(SUM(${quickEffectiveReps}) FILTER (WHERE ${inMonth} AND ${isPullUp}), 0)`,
      monthWeightedSquats: sql<number>`COALESCE(SUM(${quickEffectiveReps}) FILTER (WHERE ${inMonth} AND ${schema.exercises.slug} = 'back-squat' AND ${schema.quickActivities.weightKg} > 0), 0)`,
      totalPullUps: sql<number>`COALESCE(SUM(${quickEffectiveReps}) FILTER (WHERE ${isPullUp}), 0)`,
      benchMax: sql<number>`COALESCE(MAX(${schema.quickActivities.weightKg}) FILTER (WHERE ${schema.exercises.slug} = 'bench-press-barbell'), 0)`,
      squatMax: sql<number>`COALESCE(MAX(${schema.quickActivities.weightKg}) FILTER (WHERE ${schema.exercises.slug} = 'back-squat'), 0)`,
    })
    .from(schema.quickActivities)
    .innerJoin(
      schema.exercises,
      eq(schema.exercises.id, schema.quickActivities.exerciseId),
    )
    .where(eq(schema.quickActivities.userId, userId));

  return normalizeTotals({
    ...row,
    monthSessions: 0,
    totalSessions: 0,
    maxSessionTonnage: 0,
  });
}

async function cardioTotals(
  userId: string,
  timeZone: string,
  month: CalendarMonthBounds,
): Promise<SourceTotals> {
  const inMonth = localMonthFilter(
    schema.cardioWorkouts.startedAt,
    timeZone,
    month,
  );
  const [row] = await db
    .select({
      monthSessions: sql<number>`COUNT(*) FILTER (WHERE ${inMonth})`,
      totalSessions: sql<number>`COUNT(*)`,
    })
    .from(schema.cardioWorkouts)
    .where(
      and(
        eq(schema.cardioWorkouts.userId, userId),
        eq(schema.cardioWorkouts.status, "completed"),
      ),
    );

  return normalizeTotals({
    ...row,
    monthSets: 0,
    monthReps: 0,
    monthTonnage: 0,
    totalTonnage: 0,
    maxSessionTonnage: 0,
    monthPullUps: 0,
    monthWeightedSquats: 0,
    totalPullUps: 0,
    benchMax: 0,
    squatMax: 0,
  });
}

async function manualRecordMaximums(userId: string) {
  const [row] = await db
    .select({
      benchMax: sql<number>`COALESCE(MAX(${schema.strengthRecords.value}) FILTER (WHERE ${schema.strengthRecords.movement} = 'bench_press'), 0)`,
      squatMax: sql<number>`COALESCE(MAX(${schema.strengthRecords.value}) FILTER (WHERE ${schema.strengthRecords.movement} = 'back_squat'), 0)`,
    })
    .from(schema.strengthRecords)
    .where(eq(schema.strengthRecords.userId, userId));

  return {
    benchMax: Number(row?.benchMax ?? 0),
    squatMax: Number(row?.squatMax ?? 0),
  };
}

async function strengthMaxSessionTonnage(userId: string): Promise<number> {
  const byWorkout = db
    .select({
      workoutId: schema.workouts.id,
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
        eq(
          schema.workoutSets.workoutExerciseId,
          schema.workoutExercises.id,
        ),
        eq(schema.workoutSets.setType, "working"),
      ),
    )
    .where(
      and(
        eq(schema.workouts.userId, userId),
        eq(schema.workouts.status, "completed"),
      ),
    )
    .groupBy(schema.workouts.id)
    .as("strength_session_tonnage");

  const [row] = await db
    .select({
      maxSessionTonnage: sql<number>`COALESCE(MAX(${byWorkout.tonnage}), 0)`,
    })
    .from(byWorkout);

  return Number(row?.maxSessionTonnage ?? 0);
}

async function circuitMaxSessionTonnage(userId: string): Promise<number> {
  const byWorkout = db
    .select({
      workoutId: schema.circuitWorkouts.id,
      tonnage: sql<number>`COALESCE(SUM(${schema.circuitRoundLogs.actualWeightKg} * ${schema.circuitRoundLogs.actualReps}) FILTER (WHERE ${schema.circuitRoundLogs.skipped} = false), 0)`,
    })
    .from(schema.circuitWorkouts)
    .leftJoin(
      schema.circuitExercises,
      eq(
        schema.circuitExercises.circuitWorkoutId,
        schema.circuitWorkouts.id,
      ),
    )
    .leftJoin(
      schema.circuitRoundLogs,
      and(
        eq(
          schema.circuitRoundLogs.circuitExerciseId,
          schema.circuitExercises.id,
        ),
        eq(
          schema.circuitRoundLogs.circuitWorkoutId,
          schema.circuitWorkouts.id,
        ),
      ),
    )
    .where(
      and(
        eq(schema.circuitWorkouts.userId, userId),
        eq(schema.circuitWorkouts.status, "completed"),
      ),
    )
    .groupBy(schema.circuitWorkouts.id)
    .as("circuit_session_tonnage");

  const [row] = await db
    .select({
      maxSessionTonnage: sql<number>`COALESCE(MAX(${byWorkout.tonnage}), 0)`,
    })
    .from(byWorkout);

  return Number(row?.maxSessionTonnage ?? 0);
}

function localMonthFilter(
  column: PgColumn,
  timeZone: string,
  month: CalendarMonthBounds,
) {
  return sql<boolean>`${column} AT TIME ZONE ${timeZone} >= ${month.start}::date
    AND ${column} AT TIME ZONE ${timeZone} < ${month.end}::date`;
}

function normalizeTotals(row: Partial<SourceTotals> | undefined): SourceTotals {
  return {
    monthSessions: Number(row?.monthSessions ?? 0),
    totalSessions: Number(row?.totalSessions ?? 0),
    monthSets: Number(row?.monthSets ?? 0),
    monthReps: Number(row?.monthReps ?? 0),
    monthTonnage: Number(row?.monthTonnage ?? 0),
    totalTonnage: Number(row?.totalTonnage ?? 0),
    maxSessionTonnage: Number(row?.maxSessionTonnage ?? 0),
    monthPullUps: Number(row?.monthPullUps ?? 0),
    monthWeightedSquats: Number(row?.monthWeightedSquats ?? 0),
    totalPullUps: Number(row?.totalPullUps ?? 0),
    benchMax: Number(row?.benchMax ?? 0),
    squatMax: Number(row?.squatMax ?? 0),
  };
}
