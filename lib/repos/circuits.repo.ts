import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";

export type CircuitSummary = {
  id: string;
  name: string;
  totalRounds: number;
  restBetweenRoundsSec: number;
  restBetweenExercisesSec: number;
  status: (typeof schema.workoutStatus.enumValues)[number];
  startedAt: Date;
  finishedAt: Date | null;
  exerciseCount: number;
  completedLogCount: number;
  totalLogCount: number;
  hasAnalysis: boolean;
};

export type CircuitExerciseWithName = schema.CircuitExercise & {
  exerciseNameRu: string;
};

export type CircuitWithDetails = {
  workout: schema.CircuitWorkout;
  exercises: CircuitExerciseWithName[];
  logs: schema.CircuitRoundLog[];
};

export type StartCircuitInput = {
  name: string;
  totalRounds: number;
  restBetweenRoundsSec: number;
  restBetweenExercisesSec: number;
  exercises: Array<{
    exerciseId: string;
    kind: (typeof schema.circuitExerciseKind.enumValues)[number];
    targetReps?: number | null;
    targetDurationSec?: number | null;
    targetWeightKg?: number | null;
    notes?: string | null;
  }>;
};

/** Создаёт circuit + список упражнений с orderIdx в одной транзакции. */
export async function startCircuit(
  userId: string,
  input: StartCircuitInput,
): Promise<{ id: string }> {
  if (input.exercises.length === 0) {
    throw new Error("В круге должно быть хотя бы одно упражнение");
  }

  return db.transaction(async (tx) => {
    // Один активный сеанс на формат: закрываем любые брошенные active-круговые
    // юзера, чтобы resume-баннер не «висел» (G2). Иначе незавершённые сессии
    // копятся и getActiveCircuitId вечно возвращает старую.
    await tx
      .update(schema.circuitWorkouts)
      .set({ status: "cancelled", finishedAt: new Date() })
      .where(
        and(
          eq(schema.circuitWorkouts.userId, userId),
          eq(schema.circuitWorkouts.status, "active"),
        ),
      );

    const id = crypto.randomUUID();
    await tx.insert(schema.circuitWorkouts).values({
      id,
      userId,
      name: input.name,
      totalRounds: input.totalRounds,
      restBetweenRoundsSec: input.restBetweenRoundsSec,
      restBetweenExercisesSec: input.restBetweenExercisesSec,
      status: "active",
    });

    await tx.insert(schema.circuitExercises).values(
      input.exercises.map((e, idx) => ({
        circuitWorkoutId: id,
        exerciseId: e.exerciseId,
        orderIdx: idx,
        kind: e.kind,
        targetReps: e.kind === "reps" ? e.targetReps ?? null : null,
        targetDurationSec:
          e.kind === "duration" ? e.targetDurationSec ?? null : null,
        targetWeightKg: e.targetWeightKg ?? null,
        notes: e.notes ?? null,
      })),
    );

    return { id };
  });
}

/** G7b re-run: клонирует прошлую круговую юзера в НОВЫЙ активный сеанс — копирует
 *  план (имя, раунды, отдыхи, упражнения с целями), но НЕ логи раундов (свежий
 *  старт). Делегирует в startCircuit → тот же G2-инвариант (отменяет прошлую
 *  active-круговую). R-7: getCircuitForUser фильтрует по userId, чужую не клонируем. */
export async function cloneCircuit(
  userId: string,
  sourceId: string,
): Promise<{ id: string }> {
  const src = await getCircuitForUser(userId, sourceId);
  if (!src) throw new Error("Круговая не найдена или не твоя");

  return startCircuit(userId, {
    name: src.workout.name,
    totalRounds: src.workout.totalRounds,
    restBetweenRoundsSec: src.workout.restBetweenRoundsSec,
    restBetweenExercisesSec: src.workout.restBetweenExercisesSec,
    exercises: src.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      kind: e.kind,
      targetReps: e.targetReps,
      targetDurationSec: e.targetDurationSec,
      targetWeightKg: e.targetWeightKg,
      notes: e.notes,
    })),
  });
}

export async function getCircuitForUser(
  userId: string,
  circuitId: string,
): Promise<CircuitWithDetails | null> {
  const [w] = await db
    .select()
    .from(schema.circuitWorkouts)
    .where(
      and(
        eq(schema.circuitWorkouts.id, circuitId),
        eq(schema.circuitWorkouts.userId, userId),
      ),
    )
    .limit(1);
  if (!w) return null;

  const exercises = await db
    .select({
      id: schema.circuitExercises.id,
      circuitWorkoutId: schema.circuitExercises.circuitWorkoutId,
      exerciseId: schema.circuitExercises.exerciseId,
      orderIdx: schema.circuitExercises.orderIdx,
      kind: schema.circuitExercises.kind,
      targetReps: schema.circuitExercises.targetReps,
      targetDurationSec: schema.circuitExercises.targetDurationSec,
      targetWeightKg: schema.circuitExercises.targetWeightKg,
      notes: schema.circuitExercises.notes,
      exerciseNameRu: schema.exercises.nameRu,
    })
    .from(schema.circuitExercises)
    .innerJoin(
      schema.exercises,
      eq(schema.exercises.id, schema.circuitExercises.exerciseId),
    )
    .where(eq(schema.circuitExercises.circuitWorkoutId, circuitId))
    .orderBy(asc(schema.circuitExercises.orderIdx));

  const logs = await db
    .select()
    .from(schema.circuitRoundLogs)
    .where(eq(schema.circuitRoundLogs.circuitWorkoutId, circuitId))
    .orderBy(asc(schema.circuitRoundLogs.roundNumber));

  return { workout: w, exercises, logs };
}

export async function listCircuits(
  userId: string,
  limit = 30,
): Promise<CircuitSummary[]> {
  const rows = await db
    .select()
    .from(schema.circuitWorkouts)
    .where(eq(schema.circuitWorkouts.userId, userId))
    .orderBy(desc(schema.circuitWorkouts.startedAt))
    .limit(limit);

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);

  const exerciseCounts = await db
    .select({
      circuitWorkoutId: schema.circuitExercises.circuitWorkoutId,
      id: schema.circuitExercises.id,
    })
    .from(schema.circuitExercises)
    .where(inArray(schema.circuitExercises.circuitWorkoutId, ids));

  const logRows = await db
    .select()
    .from(schema.circuitRoundLogs)
    .where(inArray(schema.circuitRoundLogs.circuitWorkoutId, ids));

  const exByCircuit = new Map<string, number>();
  for (const e of exerciseCounts) {
    exByCircuit.set(
      e.circuitWorkoutId,
      (exByCircuit.get(e.circuitWorkoutId) ?? 0) + 1,
    );
  }

  const logsByCircuit = new Map<
    string,
    { total: number; completed: number }
  >();
  for (const l of logRows) {
    const cur = logsByCircuit.get(l.circuitWorkoutId) ?? {
      total: 0,
      completed: 0,
    };
    cur.total += 1;
    if (!l.skipped) cur.completed += 1;
    logsByCircuit.set(l.circuitWorkoutId, cur);
  }

  // AI-разбор круговой хранится в ai_analyses по circuitWorkoutId (G3).
  // Помечаем сессии с готовым разбором, чтобы единая история показала
  // тот же AI-бейдж, что и у силовых (workouts.repo: hasAnalysis).
  const analysisRows = await db
    .select({ circuitWorkoutId: schema.aiAnalyses.circuitWorkoutId })
    .from(schema.aiAnalyses)
    .where(inArray(schema.aiAnalyses.circuitWorkoutId, ids));
  const hasAnalysis = new Set(analysisRows.map((r) => r.circuitWorkoutId));

  return rows.map((w) => ({
    id: w.id,
    name: w.name,
    totalRounds: w.totalRounds,
    restBetweenRoundsSec: w.restBetweenRoundsSec,
    restBetweenExercisesSec: w.restBetweenExercisesSec,
    status: w.status,
    startedAt: w.startedAt,
    finishedAt: w.finishedAt,
    exerciseCount: exByCircuit.get(w.id) ?? 0,
    completedLogCount: logsByCircuit.get(w.id)?.completed ?? 0,
    totalLogCount: logsByCircuit.get(w.id)?.total ?? 0,
    hasAnalysis: hasAnalysis.has(w.id),
  }));
}

export async function getActiveCircuitId(
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: schema.circuitWorkouts.id })
    .from(schema.circuitWorkouts)
    .where(
      and(
        eq(schema.circuitWorkouts.userId, userId),
        eq(schema.circuitWorkouts.status, "active"),
      ),
    )
    .orderBy(desc(schema.circuitWorkouts.startedAt))
    .limit(1);
  return row?.id ?? null;
}

export type LogRoundInput = {
  circuitExerciseId: string;
  roundNumber: number;
  actualReps?: number | null;
  actualDurationSec?: number | null;
  actualWeightKg?: number | null;
  rpe?: number | null;
  skipped?: boolean;
};

/** Upsert одного «слота» (raund × exercise). Если строка уже есть —
 *  апдейтим (пользователь повторно «Готово» / меняет данные).
 *  Если нет — инсертим. */
export async function logCircuitRound(
  userId: string,
  circuitId: string,
  input: LogRoundInput,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [w] = await tx
      .select({ id: schema.circuitWorkouts.id })
      .from(schema.circuitWorkouts)
      .where(
        and(
          eq(schema.circuitWorkouts.id, circuitId),
          eq(schema.circuitWorkouts.userId, userId),
        ),
      )
      .limit(1);
    if (!w) throw new Error("Круговая не найдена или не твоя");

    const [ex] = await tx
      .select({ id: schema.circuitExercises.id })
      .from(schema.circuitExercises)
      .where(
        and(
          eq(schema.circuitExercises.id, input.circuitExerciseId),
          eq(schema.circuitExercises.circuitWorkoutId, circuitId),
        ),
      )
      .limit(1);
    if (!ex) throw new Error("Упражнение не относится к этой круговой");

    const [existing] = await tx
      .select({ id: schema.circuitRoundLogs.id })
      .from(schema.circuitRoundLogs)
      .where(
        and(
          eq(schema.circuitRoundLogs.circuitExerciseId, input.circuitExerciseId),
          eq(schema.circuitRoundLogs.roundNumber, input.roundNumber),
        ),
      )
      .limit(1);

    const payload = {
      actualReps: input.actualReps ?? null,
      actualDurationSec: input.actualDurationSec ?? null,
      actualWeightKg: input.actualWeightKg ?? null,
      rpe: input.rpe ?? null,
      skipped: input.skipped ?? false,
      completedAt: new Date(),
    };

    if (existing) {
      await tx
        .update(schema.circuitRoundLogs)
        .set(payload)
        .where(eq(schema.circuitRoundLogs.id, existing.id));
    } else {
      await tx.insert(schema.circuitRoundLogs).values({
        circuitWorkoutId: circuitId,
        circuitExerciseId: input.circuitExerciseId,
        roundNumber: input.roundNumber,
        ...payload,
      });
    }
  });
}

export async function finishCircuit(
  userId: string,
  circuitId: string,
  notes?: string | null,
): Promise<void> {
  await db
    .update(schema.circuitWorkouts)
    .set({
      status: "completed",
      finishedAt: new Date(),
      notes: notes ?? null,
    })
    .where(
      and(
        eq(schema.circuitWorkouts.id, circuitId),
        eq(schema.circuitWorkouts.userId, userId),
        eq(schema.circuitWorkouts.status, "active"),
      ),
    );
}

export async function cancelCircuit(
  userId: string,
  circuitId: string,
): Promise<void> {
  await db
    .update(schema.circuitWorkouts)
    .set({ status: "cancelled", finishedAt: new Date() })
    .where(
      and(
        eq(schema.circuitWorkouts.id, circuitId),
        eq(schema.circuitWorkouts.userId, userId),
        eq(schema.circuitWorkouts.status, "active"),
      ),
    );
}

export async function deleteCircuit(
  userId: string,
  circuitId: string,
): Promise<void> {
  await db
    .delete(schema.circuitWorkouts)
    .where(
      and(
        eq(schema.circuitWorkouts.id, circuitId),
        eq(schema.circuitWorkouts.userId, userId),
      ),
    );
}
