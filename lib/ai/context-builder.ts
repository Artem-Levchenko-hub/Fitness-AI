import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  bestEstimatedOneRepMax,
  estimatedOneRepMax,
  totalVolume,
} from "@/lib/domain";

type WorkoutSummary = {
  workoutId: string;
  name: string;
  startedAt: Date;
  exercises: Array<{
    exerciseId: string;
    nameRu: string;
    sets: Array<{
      weightKg: number;
      reps: number;
      rpe: number | null;
      setType: "working" | "warmup" | "drop" | "failure";
    }>;
  }>;
};

const HISTORY_DAYS = 60;
const MAX_HISTORY_WORKOUTS = 12;

/** Собирает markdown-контекст для DeepSeek: сегодняшняя тренировка + N
 *  прошлых + relevant exercise_notes + workout_notes + cycle_note + 1RM
 *  trend по упражнениям этой тренировки. */
export async function buildCoachContext(
  userId: string,
  workoutId: string,
): Promise<string> {
  const todayWorkout = await loadWorkoutSummary(userId, workoutId);
  if (!todayWorkout) return "(контекст недоступен)";

  const exerciseIds = [
    ...new Set(todayWorkout.exercises.map((e) => e.exerciseId)),
  ];

  const since = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000);

  // История прошлых тренировок
  const pastWorkouts = await loadPastWorkouts(userId, workoutId, since);

  // Relevant exercise notes (для упражнений сегодняшней тренировки)
  const exerciseNotes = exerciseIds.length
    ? await db
        .select({
          exerciseId: schema.exerciseNotes.exerciseId,
          content: schema.exerciseNotes.content,
          updatedAt: schema.exerciseNotes.updatedAt,
          nameRu: schema.exercises.nameRu,
        })
        .from(schema.exerciseNotes)
        .innerJoin(
          schema.exercises,
          eq(schema.exercises.id, schema.exerciseNotes.exerciseId),
        )
        .where(
          and(
            eq(schema.exerciseNotes.userId, userId),
            inArray(schema.exerciseNotes.exerciseId, exerciseIds),
          ),
        )
        .orderBy(desc(schema.exerciseNotes.updatedAt))
    : [];

  // Последние workout_notes
  const recentWorkoutNotes = await db
    .select({
      workoutId: schema.workoutNotes.workoutId,
      content: schema.workoutNotes.content,
      updatedAt: schema.workoutNotes.updatedAt,
    })
    .from(schema.workoutNotes)
    .where(eq(schema.workoutNotes.userId, userId))
    .orderBy(desc(schema.workoutNotes.updatedAt))
    .limit(4);

  // Текущий cycle note (если уже есть на этой неделе)
  const recentCycleNotes = await db
    .select()
    .from(schema.cycleNotes)
    .where(eq(schema.cycleNotes.userId, userId))
    .orderBy(desc(schema.cycleNotes.updatedAt))
    .limit(2);

  // 1RM trend по упражнениям сегодняшней тренировки
  const oneRmTrends = compute1RmTrends(todayWorkout, pastWorkouts);

  // Volume by muscle за 4 недели — упрощённо: суммируем волюм по primary muscle
  const volumeByMuscle = await loadVolumeByMuscle(userId, since);

  const sections: string[] = [];

  sections.push(`# Сегодняшняя тренировка\n\n${formatWorkout(todayWorkout)}`);

  if (oneRmTrends.length > 0) {
    sections.push(
      `# Прогресс 1RM (estimated)\n\n${oneRmTrends.map(formatOneRmTrend).join("\n")}`,
    );
  }

  if (volumeByMuscle.length > 0) {
    sections.push(
      `# Объём по группам мышц за 4 недели (kg×reps)\n\n${volumeByMuscle.map((v) => `- **${v.muscleKey}**: ${Math.round(v.volume).toLocaleString("ru")}`).join("\n")}`,
    );
  }

  if (pastWorkouts.length > 0) {
    sections.push(
      `# Последние ${pastWorkouts.length} тренировок\n\n${pastWorkouts
        .map(formatWorkoutCompact)
        .join("\n\n")}`,
    );
  }

  if (exerciseNotes.length > 0) {
    sections.push(
      `# Заметки по упражнениям из сегодняшней тренировки\n\n${exerciseNotes
        .map((n) => `## ${n.nameRu}\n_(обновлено ${formatDate(n.updatedAt)})_\n\n${n.content}`)
        .join("\n\n")}`,
    );
  }

  if (recentWorkoutNotes.length > 0) {
    sections.push(
      `# Последние заметки по тренировкам\n\n${recentWorkoutNotes
        .map((n) => `_(${formatDate(n.updatedAt)})_\n${n.content}`)
        .join("\n\n---\n\n")}`,
    );
  }

  if (recentCycleNotes.length > 0) {
    sections.push(
      `# Заметки по микроциклам\n\n${recentCycleNotes
        .map((n) => `## ${n.weekIso}\n${n.content}`)
        .join("\n\n")}`,
    );
  }

  return sections.join("\n\n");
}

async function loadWorkoutSummary(
  userId: string,
  workoutId: string,
): Promise<WorkoutSummary | null> {
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
      nameRu: schema.exercises.nameRu,
    })
    .from(schema.workoutExercises)
    .innerJoin(
      schema.exercises,
      eq(schema.exercises.id, schema.workoutExercises.exerciseId),
    )
    .where(eq(schema.workoutExercises.workoutId, workoutId))
    .orderBy(asc(schema.workoutExercises.position));

  const weIds = exerciseRows.map((r) => r.id);
  const sets = weIds.length
    ? await db
        .select()
        .from(schema.workoutSets)
        .where(inArray(schema.workoutSets.workoutExerciseId, weIds))
        .orderBy(asc(schema.workoutSets.setIndex))
    : [];

  const setsByWe = new Map<string, typeof sets>();
  for (const s of sets) {
    const arr = setsByWe.get(s.workoutExerciseId) ?? [];
    arr.push(s);
    setsByWe.set(s.workoutExerciseId, arr);
  }

  return {
    workoutId: w.id,
    name: w.name,
    startedAt: w.startedAt,
    exercises: exerciseRows.map((r) => ({
      exerciseId: r.exerciseId,
      nameRu: r.nameRu,
      sets: (setsByWe.get(r.id) ?? []).map((s) => ({
        weightKg: s.weightKg,
        reps: s.reps,
        rpe: s.rpe,
        setType: s.setType,
      })),
    })),
  };
}

async function loadPastWorkouts(
  userId: string,
  excludeWorkoutId: string,
  since: Date,
): Promise<WorkoutSummary[]> {
  const rows = await db
    .select({
      id: schema.workouts.id,
      name: schema.workouts.name,
      startedAt: schema.workouts.startedAt,
    })
    .from(schema.workouts)
    .where(
      and(
        eq(schema.workouts.userId, userId),
        eq(schema.workouts.status, "completed"),
        gte(schema.workouts.startedAt, since),
        sql`${schema.workouts.id} <> ${excludeWorkoutId}`,
      ),
    )
    .orderBy(desc(schema.workouts.startedAt))
    .limit(MAX_HISTORY_WORKOUTS);

  if (rows.length === 0) return [];

  const wids = rows.map((r) => r.id);
  const exRows = await db
    .select({
      we_id: schema.workoutExercises.id,
      workoutId: schema.workoutExercises.workoutId,
      exerciseId: schema.workoutExercises.exerciseId,
      nameRu: schema.exercises.nameRu,
      position: schema.workoutExercises.position,
    })
    .from(schema.workoutExercises)
    .innerJoin(
      schema.exercises,
      eq(schema.exercises.id, schema.workoutExercises.exerciseId),
    )
    .where(inArray(schema.workoutExercises.workoutId, wids))
    .orderBy(asc(schema.workoutExercises.position));

  const weIds = exRows.map((r) => r.we_id);
  const sets = weIds.length
    ? await db
        .select()
        .from(schema.workoutSets)
        .where(inArray(schema.workoutSets.workoutExerciseId, weIds))
        .orderBy(asc(schema.workoutSets.setIndex))
    : [];

  const setsByWe = new Map<string, typeof sets>();
  for (const s of sets) {
    const arr = setsByWe.get(s.workoutExerciseId) ?? [];
    arr.push(s);
    setsByWe.set(s.workoutExerciseId, arr);
  }

  const exsByWorkout = new Map<string, WorkoutSummary["exercises"]>();
  for (const ex of exRows) {
    const arr = exsByWorkout.get(ex.workoutId) ?? [];
    arr.push({
      exerciseId: ex.exerciseId,
      nameRu: ex.nameRu,
      sets: (setsByWe.get(ex.we_id) ?? []).map((s) => ({
        weightKg: s.weightKg,
        reps: s.reps,
        rpe: s.rpe,
        setType: s.setType,
      })),
    });
    exsByWorkout.set(ex.workoutId, arr);
  }

  return rows.map((r) => ({
    workoutId: r.id,
    name: r.name,
    startedAt: r.startedAt,
    exercises: exsByWorkout.get(r.id) ?? [],
  }));
}

function compute1RmTrends(
  today: WorkoutSummary,
  past: WorkoutSummary[],
): Array<{
  exerciseId: string;
  nameRu: string;
  todayKg: number;
  previousKg: number | null;
  pointsCount: number;
}> {
  const exerciseNames = new Map<string, string>();
  for (const e of today.exercises) exerciseNames.set(e.exerciseId, e.nameRu);

  const trends: Array<{
    exerciseId: string;
    nameRu: string;
    todayKg: number;
    previousKg: number | null;
    pointsCount: number;
  }> = [];

  for (const e of today.exercises) {
    const todayKg = bestEstimatedOneRepMax(e.sets);
    if (todayKg === 0) continue;

    let previousKg = 0;
    let pointsCount = 0;
    for (const w of past) {
      const sameEx = w.exercises.find((x) => x.exerciseId === e.exerciseId);
      if (!sameEx) continue;
      pointsCount += 1;
      const kg = bestEstimatedOneRepMax(sameEx.sets);
      if (kg > previousKg) previousKg = kg;
    }

    trends.push({
      exerciseId: e.exerciseId,
      nameRu: exerciseNames.get(e.exerciseId) ?? "?",
      todayKg,
      previousKg: pointsCount > 0 ? previousKg : null,
      pointsCount,
    });
  }
  return trends;
}

async function loadVolumeByMuscle(
  userId: string,
  since: Date,
): Promise<Array<{ muscleKey: string; volume: number }>> {
  const rows = await db
    .select({
      muscleKey: schema.exerciseMuscleGroups.muscleGroupKey,
      role: schema.exerciseMuscleGroups.role,
      weightKg: schema.workoutSets.weightKg,
      reps: schema.workoutSets.reps,
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
        gte(schema.workouts.startedAt, since),
      ),
    );

  const acc = new Map<string, number>();
  for (const r of rows) {
    if (r.setType !== "working") continue;
    const factor = r.role === "primary" ? 1 : 0.5;
    const v = r.weightKg * r.reps * factor;
    acc.set(r.muscleKey, (acc.get(r.muscleKey) ?? 0) + v);
  }
  return Array.from(acc.entries())
    .map(([muscleKey, volume]) => ({ muscleKey, volume }))
    .sort((a, b) => b.volume - a.volume);
}

function formatWorkout(w: WorkoutSummary): string {
  const lines = [`**${w.name}** · ${formatDate(w.startedAt)}`];
  for (const e of w.exercises) {
    if (e.sets.length === 0) {
      lines.push(`- ${e.nameRu}: (без подходов)`);
      continue;
    }
    const setsStr = e.sets
      .map((s, i) => {
        const rpe = s.rpe != null ? ` @${s.rpe}` : "";
        const tag =
          s.setType !== "working"
            ? ` (${s.setType})`
            : "";
        return `${i + 1}) ${s.weightKg}×${s.reps}${rpe}${tag}`;
      })
      .join(", ");
    const tv = totalVolume(e.sets);
    const e1rm = bestEstimatedOneRepMax(e.sets);
    lines.push(
      `- **${e.nameRu}**: ${setsStr}\n  vol=${Math.round(tv)} kg·reps, e1RM=${e1rm.toFixed(1)} kg`,
    );
  }
  return lines.join("\n");
}

function formatWorkoutCompact(w: WorkoutSummary): string {
  const lines = [`### ${w.name} · ${formatDate(w.startedAt)}`];
  for (const e of w.exercises) {
    const top = topWorkingSet(e.sets);
    if (!top) {
      lines.push(`- ${e.nameRu}: —`);
      continue;
    }
    const e1 = estimatedOneRepMax(top.weightKg, top.reps);
    lines.push(
      `- ${e.nameRu}: ${e.sets.length} подх., top ${top.weightKg}×${top.reps} (e1RM ${e1.toFixed(1)})`,
    );
  }
  return lines.join("\n");
}

function topWorkingSet(
  sets: WorkoutSummary["exercises"][number]["sets"],
): { weightKg: number; reps: number } | null {
  let best: { weightKg: number; reps: number } | null = null;
  let bestE1Rm = 0;
  for (const s of sets) {
    if (s.setType !== "working") continue;
    const e = estimatedOneRepMax(s.weightKg, s.reps);
    if (e > bestE1Rm) {
      bestE1Rm = e;
      best = { weightKg: s.weightKg, reps: s.reps };
    }
  }
  return best;
}

function formatOneRmTrend(t: {
  nameRu: string;
  todayKg: number;
  previousKg: number | null;
}): string {
  if (t.previousKg == null || t.previousKg === 0) {
    return `- **${t.nameRu}**: сегодня e1RM ${t.todayKg.toFixed(1)} kg (нет прошлых данных)`;
  }
  const delta = t.todayKg - t.previousKg;
  const sign = delta >= 0 ? "+" : "";
  return `- **${t.nameRu}**: ${t.previousKg.toFixed(1)} → ${t.todayKg.toFixed(1)} kg (${sign}${delta.toFixed(1)})`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
