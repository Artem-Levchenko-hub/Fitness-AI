import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";

type WorkoutStatusLiteral = (typeof schema.workoutStatus.enumValues)[number];
type SetTypeLiteral = (typeof schema.setType.enumValues)[number];

export type ActiveWorkoutSet = {
  id: string;
  setIndex: number;
  setType: SetTypeLiteral;
  weightKg: number;
  reps: number;
  rpe: number | null;
  restSeconds: number | null;
  completedAt: Date;
};

export type ActiveWorkoutExercise = {
  id: string;
  exerciseId: string;
  position: number;
  exerciseNameRu: string;
  exerciseNameEn: string;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  targetWeightKg: number | null;
  targetRestSeconds: number;
  sets: ActiveWorkoutSet[];
};

export type ActiveWorkout = {
  id: string;
  name: string;
  status: WorkoutStatusLiteral;
  startedAt: Date;
  finishedAt: Date | null;
  exercises: ActiveWorkoutExercise[];
};

export async function startWorkoutFromTemplate(
  userId: string,
  templateId: string,
): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const [tpl] = await tx
      .select({ id: schema.workoutTemplates.id, name: schema.workoutTemplates.name })
      .from(schema.workoutTemplates)
      .where(
        and(
          eq(schema.workoutTemplates.id, templateId),
          eq(schema.workoutTemplates.userId, userId),
        ),
      )
      .limit(1);

    if (!tpl) throw new Error("Template not found or not yours");

    const tplItems = await tx
      .select()
      .from(schema.templateExercises)
      .where(eq(schema.templateExercises.templateId, templateId))
      .orderBy(asc(schema.templateExercises.position));

    const workoutId = crypto.randomUUID();
    await tx.insert(schema.workouts).values({
      id: workoutId,
      userId,
      templateId,
      name: tpl.name,
      status: "active",
    });

    if (tplItems.length > 0) {
      await tx.insert(schema.workoutExercises).values(
        tplItems.map((it) => ({
          workoutId,
          exerciseId: it.exerciseId,
          position: it.position,
          notes: it.notes,
        })),
      );
    }

    return { id: workoutId };
  });
}

export async function getActiveWorkoutForUser(
  userId: string,
  workoutId: string,
): Promise<ActiveWorkout | null> {
  const [w] = await db
    .select()
    .from(schema.workouts)
    .where(
      and(
        eq(schema.workouts.id, workoutId),
        eq(schema.workouts.userId, userId),
      ),
    )
    .limit(1);
  if (!w) return null;

  const exerciseRows = await db
    .select({
      id: schema.workoutExercises.id,
      exerciseId: schema.workoutExercises.exerciseId,
      position: schema.workoutExercises.position,
      exerciseNameRu: schema.exercises.nameRu,
      exerciseNameEn: schema.exercises.nameEn,
    })
    .from(schema.workoutExercises)
    .innerJoin(
      schema.exercises,
      eq(schema.exercises.id, schema.workoutExercises.exerciseId),
    )
    .where(eq(schema.workoutExercises.workoutId, workoutId))
    .orderBy(asc(schema.workoutExercises.position));

  const weIds = exerciseRows.map((r) => r.id);

  const setsRows = weIds.length
    ? await db
        .select()
        .from(schema.workoutSets)
        .where(inArray(schema.workoutSets.workoutExerciseId, weIds))
        .orderBy(
          asc(schema.workoutSets.workoutExerciseId),
          asc(schema.workoutSets.setIndex),
        )
    : [];

  const setsByWe = new Map<string, ActiveWorkoutSet[]>();
  for (const s of setsRows) {
    const arr = setsByWe.get(s.workoutExerciseId) ?? [];
    arr.push(s);
    setsByWe.set(s.workoutExerciseId, arr);
  }

  // Цели берём из шаблона, если он есть, иначе разумные default'ы
  const templateTargets = new Map<
    string,
    {
      targetSets: number;
      targetRepsMin: number;
      targetRepsMax: number;
      targetWeightKg: number | null;
      targetRestSeconds: number;
    }
  >();
  if (w.templateId) {
    const tplItems = await db
      .select({
        exerciseId: schema.templateExercises.exerciseId,
        targetSets: schema.templateExercises.targetSets,
        targetRepsMin: schema.templateExercises.targetRepsMin,
        targetRepsMax: schema.templateExercises.targetRepsMax,
        targetWeightKg: schema.templateExercises.targetWeightKg,
        targetRestSeconds: schema.templateExercises.targetRestSeconds,
      })
      .from(schema.templateExercises)
      .where(eq(schema.templateExercises.templateId, w.templateId));
    for (const it of tplItems) templateTargets.set(it.exerciseId, it);
  }

  const exercises: ActiveWorkoutExercise[] = exerciseRows.map((r) => {
    const t = templateTargets.get(r.exerciseId);
    return {
      ...r,
      targetSets: t?.targetSets ?? 3,
      targetRepsMin: t?.targetRepsMin ?? 8,
      targetRepsMax: t?.targetRepsMax ?? 12,
      targetWeightKg: t?.targetWeightKg ?? null,
      targetRestSeconds: t?.targetRestSeconds ?? 120,
      sets: setsByWe.get(r.id) ?? [],
    };
  });

  return {
    id: w.id,
    name: w.name,
    status: w.status,
    startedAt: w.startedAt,
    finishedAt: w.finishedAt,
    exercises,
  };
}

export type RecordSetInput = {
  workoutExerciseId: string;
  setIndex: number;
  weightKg: number;
  reps: number;
  rpe?: number | null;
  restSeconds?: number | null;
  setType?: SetTypeLiteral;
};

export async function recordSet(
  userId: string,
  workoutId: string,
  input: RecordSetInput,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [w] = await tx
      .select({ id: schema.workouts.id })
      .from(schema.workouts)
      .where(
        and(
          eq(schema.workouts.id, workoutId),
          eq(schema.workouts.userId, userId),
        ),
      )
      .limit(1);
    if (!w) throw new Error("Workout not found or not yours");

    const [we] = await tx
      .select({ id: schema.workoutExercises.id })
      .from(schema.workoutExercises)
      .where(
        and(
          eq(schema.workoutExercises.id, input.workoutExerciseId),
          eq(schema.workoutExercises.workoutId, workoutId),
        ),
      )
      .limit(1);
    if (!we) throw new Error("Exercise not part of this workout");

    await tx.insert(schema.workoutSets).values({
      workoutExerciseId: input.workoutExerciseId,
      setIndex: input.setIndex,
      setType: input.setType ?? "working",
      weightKg: input.weightKg,
      reps: input.reps,
      rpe: input.rpe ?? null,
      restSeconds: input.restSeconds ?? null,
      completedAt: new Date(),
    });
  });
}

export async function deleteSet(
  userId: string,
  workoutId: string,
  setId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [chk] = await tx
      .select({ workoutId: schema.workoutExercises.workoutId })
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
          eq(schema.workoutSets.id, setId),
          eq(schema.workouts.userId, userId),
          eq(schema.workouts.id, workoutId),
        ),
      )
      .limit(1);
    if (!chk) throw new Error("Set not yours or not in this workout");

    await tx.delete(schema.workoutSets).where(eq(schema.workoutSets.id, setId));
  });
}

export async function finishWorkout(
  userId: string,
  workoutId: string,
): Promise<void> {
  await db
    .update(schema.workouts)
    .set({
      status: "completed",
      finishedAt: new Date(),
    })
    .where(
      and(
        eq(schema.workouts.id, workoutId),
        eq(schema.workouts.userId, userId),
        eq(schema.workouts.status, "active"),
      ),
    );
}

export type RecentWorkout = {
  id: string;
  name: string;
  status: WorkoutStatusLiteral;
  startedAt: Date;
  finishedAt: Date | null;
  setCount: number;
  tonnageKg: number;
  hasAnalysis: boolean;
};

export async function listRecentWorkouts(
  userId: string,
  limit = 30,
): Promise<RecentWorkout[]> {
  const rows = await db
    .select({
      id: schema.workouts.id,
      name: schema.workouts.name,
      status: schema.workouts.status,
      startedAt: schema.workouts.startedAt,
      finishedAt: schema.workouts.finishedAt,
    })
    .from(schema.workouts)
    .where(eq(schema.workouts.userId, userId))
    .orderBy(desc(schema.workouts.startedAt))
    .limit(limit);

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);

  const setRows = await db
    .select({
      workoutId: schema.workoutExercises.workoutId,
      weightKg: schema.workoutSets.weightKg,
      reps: schema.workoutSets.reps,
    })
    .from(schema.workoutSets)
    .innerJoin(
      schema.workoutExercises,
      eq(schema.workoutExercises.id, schema.workoutSets.workoutExerciseId),
    )
    .where(inArray(schema.workoutExercises.workoutId, ids));

  const setCount = new Map<string, number>();
  const tonnage = new Map<string, number>();
  for (const r of setRows) {
    setCount.set(r.workoutId, (setCount.get(r.workoutId) ?? 0) + 1);
    tonnage.set(
      r.workoutId,
      (tonnage.get(r.workoutId) ?? 0) + r.weightKg * r.reps,
    );
  }

  const analysisRows = await db
    .select({ workoutId: schema.aiAnalyses.workoutId })
    .from(schema.aiAnalyses)
    .where(inArray(schema.aiAnalyses.workoutId, ids));
  const hasAnalysis = new Set(analysisRows.map((r) => r.workoutId));

  return rows.map((r) => ({
    ...r,
    setCount: setCount.get(r.id) ?? 0,
    tonnageKg: tonnage.get(r.id) ?? 0,
    hasAnalysis: hasAnalysis.has(r.id),
  }));
}

export async function getAiAnalysisForWorkout(
  userId: string,
  workoutId: string,
): Promise<{
  id: string;
  content: string;
  modelVersion: string;
  createdAt: Date;
} | null> {
  const [row] = await db
    .select({
      id: schema.aiAnalyses.id,
      content: schema.aiAnalyses.content,
      modelVersion: schema.aiAnalyses.modelVersion,
      createdAt: schema.aiAnalyses.createdAt,
    })
    .from(schema.aiAnalyses)
    .where(
      and(
        eq(schema.aiAnalyses.workoutId, workoutId),
        eq(schema.aiAnalyses.userId, userId),
      ),
    )
    .orderBy(desc(schema.aiAnalyses.createdAt))
    .limit(1);
  return row ?? null;
}

export async function getActiveWorkoutId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: schema.workouts.id })
    .from(schema.workouts)
    .where(
      and(
        eq(schema.workouts.userId, userId),
        eq(schema.workouts.status, "active"),
      ),
    )
    .orderBy(desc(schema.workouts.startedAt))
    .limit(1);
  return row?.id ?? null;
}
