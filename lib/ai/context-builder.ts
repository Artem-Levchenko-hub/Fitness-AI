import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  ageFromBirthDateString,
  bestEstimatedOneRepMax,
  bodyweightEffectiveLoad,
  computeScheduleAdherence,
  estimatedOneRepMax,
  totalVolume,
  type DayCell,
  type ScheduleAdherence,
  type ScheduleLite,
} from "@/lib/domain";
import { localDateIso, localIsoDay } from "@/lib/datetime/local-day";
import { formatDays, formatHour, WEEKDAYS } from "@/lib/ui/weekdays";
import {
  formatExerciseComparison,
  type ExerciseComparisonPoint,
} from "./exercise-comparison";

type AiJobKindLiteral = (typeof schema.aiJobKind.enumValues)[number];

type WorkoutSummary = {
  workoutId: string;
  name: string;
  startedAt: Date;
  exercises: Array<{
    exerciseId: string;
    nameRu: string;
    isBodyweight: boolean;
    sets: Array<{
      weightKg: number;
      reps: number;
      rpe: number | null;
      setType: "working" | "warmup" | "drop" | "failure";
    }>;
  }>;
};

const HISTORY_DAYS = 60;
const MAX_HISTORY_WORKOUTS = 10;
const CIRCUIT_HISTORY_DAYS = 60;
const MAX_CIRCUIT_HISTORY = 10;

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

  const pastWorkouts = await loadPastWorkouts(userId, workoutId, since);
  // Текущий вес тела — для численной эффективной нагрузки bodyweight-упражнений.
  // Историю веса тела по дате не храним → к прошлым тренировкам применяем тот же
  // вес (аппроксимация: за 60 дней колебания малы относительно тотала).
  const bodyweightKg = await loadLatestBodyweight(userId);

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

  const recentCycleNotes = await db
    .select()
    .from(schema.cycleNotes)
    .where(eq(schema.cycleNotes.userId, userId))
    .orderBy(desc(schema.cycleNotes.updatedAt))
    .limit(2);

  const oneRmTrends = compute1RmTrends(todayWorkout, pastWorkouts);
  const allTimeBest = await loadAllTimeBestE1rm(userId, exerciseIds, workoutId);
  const comparisons = buildExerciseComparisons(
    pastWorkouts,
    oneRmTrends,
    allTimeBest,
  );
  const volumeByMuscle = await loadVolumeByMuscle(userId, since);

  const sections: string[] = [];

  sections.push(
    `# Сегодняшняя тренировка\n\n${formatWorkout(todayWorkout, bodyweightKg)}`,
  );

  if (comparisons.length > 0) {
    sections.push(
      `# Сравнение с прошлым (по упражнениям сегодняшней силовой)\n\n${comparisons
        .map(formatExerciseComparison)
        .join("\n\n")}`,
    );
  }

  if (volumeByMuscle.length > 0) {
    sections.push(
      `# Объём по группам мышц за 4 недели (kg×reps)\n\n${volumeByMuscle.map((v) => `- **${v.muscleKey}**: ${Math.round(v.volume).toLocaleString("ru")}`).join("\n")}`,
    );
  }

  if (pastWorkouts.length > 0) {
    sections.push(
      `# Последние ${pastWorkouts.length} тренировок (полностью, set-by-set)\n\n${pastWorkouts
        .map((w) => formatWorkout(w, bodyweightKg))
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
      isBodyweight: schema.exercises.isBodyweight,
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
      isBodyweight: r.isBodyweight,
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
      isBodyweight: schema.exercises.isBodyweight,
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
      isBodyweight: ex.isBodyweight,
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

/** Сшивает per-упражнение блоки «сравнение с прошлым» (H5.3): тренд e1RM +
 *  последняя прошлая сессия этого упражнения set-by-set + дистанция до PR.
 *  Берёт упражнения из oneRmTrends (todayKg>0; bodyweight с нулевой добавкой
 *  туда не попадают — их детальная нагрузка уже в formatWorkout). */
function buildExerciseComparisons(
  pastWorkouts: WorkoutSummary[],
  trends: ReturnType<typeof compute1RmTrends>,
  allTimeBest: Map<string, number>,
): ExerciseComparisonPoint[] {
  return trends.map((t) => ({
    nameRu: t.nameRu,
    trend: { nameRu: t.nameRu, todayKg: t.todayKg, previousKg: t.previousKg },
    previousSession: findPreviousSession(pastWorkouts, t.exerciseId),
    allTimeBestE1rm: allTimeBest.get(t.exerciseId) ?? null,
  }));
}

/** Последняя по времени прошлая сессия с этим упражнением (pastWorkouts уже
 *  desc по startedAt). Рабочие подходы приоритетны; если их нет — все. */
function findPreviousSession(
  pastWorkouts: WorkoutSummary[],
  exerciseId: string,
): ExerciseComparisonPoint["previousSession"] {
  for (const w of pastWorkouts) {
    const ex = w.exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex) continue;
    const working = ex.sets.filter((s) => s.setType === "working");
    const chosen = working.length > 0 ? working : ex.sets;
    if (chosen.length === 0) continue;
    return {
      dateLabel: formatDate(w.startedAt),
      sets: chosen.map((s) => ({ weightKg: s.weightKg, reps: s.reps })),
    };
  }
  return null;
}

/** Лучший e1RM за всю историю по каждому из exerciseIds, ИСКЛЮЧАЯ сегодняшнюю
 *  тренировку — база «дистанции до личного рекорда» (H5.3). Только working
 *  подходы завершённых тренировок (как bestEstimatedOneRepMax и /stats). */
async function loadAllTimeBestE1rm(
  userId: string,
  exerciseIds: string[],
  excludeWorkoutId: string,
): Promise<Map<string, number>> {
  if (exerciseIds.length === 0) return new Map();
  const rows = await db
    .select({
      exerciseId: schema.workoutExercises.exerciseId,
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
    .where(
      and(
        eq(schema.workouts.userId, userId),
        eq(schema.workouts.status, "completed"),
        inArray(schema.workoutExercises.exerciseId, exerciseIds),
        sql`${schema.workouts.id} <> ${excludeWorkoutId}`,
      ),
    );

  const best = new Map<string, number>();
  for (const r of rows) {
    if (r.setType !== "working") continue;
    const e = estimatedOneRepMax(r.weightKg, r.reps);
    const cur = best.get(r.exerciseId) ?? 0;
    if (e > cur) best.set(r.exerciseId, e);
  }
  return best;
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
        // Только завершённые тренировки (G1) — как /stats и 3D-аватар
        // (muscleHeatProfile). Раньше фильтра не было: AI считал объём
        // active/cancelled-сессий и расходился с тем, что видит пользователь.
        eq(schema.workouts.status, "completed"),
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

function formatWorkout(
  w: WorkoutSummary,
  bodyweightKg?: number | null,
): string {
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
    // Для bodyweight-упражнений введённый вес = добавка → даём AI численную
    // эффективную нагрузку (вес тела + добавка) и долю добавки в тотале.
    const bwLoad =
      e.isBodyweight && bodyweightKg != null
        ? bodyweightEffectiveLoad(bodyweightKg, e.sets)
        : null;
    const bwLine = bwLoad
      ? `\n  вес тела ${bodyweightKg} кг → эфф. нагрузка top-set ≈ ${bwLoad.effectiveKg} кг (добавка ${bwLoad.addedKg} кг = ${bwLoad.pct}% тотала)`
      : "";
    lines.push(
      `- **${e.nameRu}**: ${setsStr}\n  vol=${Math.round(tv)} kg·reps, e1RM=${e1rm.toFixed(1)} kg${bwLine}`,
    );
  }
  return lines.join("\n");
}

/** Последний записанный вес тела атлета (kg) или null. Используется для
 *  численной эффективной нагрузки bodyweight-упражнений в formatWorkout. */
async function loadLatestBodyweight(userId: string): Promise<number | null> {
  const [body] = await db
    .select({ weightKg: schema.bodyMeasurements.weightKg })
    .from(schema.bodyMeasurements)
    .where(eq(schema.bodyMeasurements.userId, userId))
    .orderBy(desc(schema.bodyMeasurements.measuredAt))
    .limit(1);
  return body?.weightKg ?? null;
}

/** Блок «Профиль атлета» для AI: вес тела + рост + возраст + явная подсказка
 *  считать относительную нагрузку для bodyweight-упражнений. */
async function loadAthleteProfileBlock(userId: string): Promise<string> {
  const [user] = await db
    .select({
      heightCm: schema.users.heightCm,
      birthDate: schema.users.birthDate,
      sex: schema.users.sex,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  const [body] = await db
    .select({
      weightKg: schema.bodyMeasurements.weightKg,
      bodyFatPct: schema.bodyMeasurements.bodyFatPct,
      measuredAt: schema.bodyMeasurements.measuredAt,
    })
    .from(schema.bodyMeasurements)
    .where(eq(schema.bodyMeasurements.userId, userId))
    .orderBy(desc(schema.bodyMeasurements.measuredAt))
    .limit(1);

  const lines: string[] = ["# Профиль атлета"];
  if (body?.weightKg != null) {
    lines.push(
      `- Вес тела: ${body.weightKg} кг (замер ${formatDate(body.measuredAt)})`,
    );
  } else {
    lines.push("- Вес тела: нет данных (попроси записать в разделе «Тело»)");
  }
  if (user?.heightCm != null) lines.push(`- Рост: ${user.heightCm} см`);
  if (body?.bodyFatPct != null) lines.push(`- % жира: ${body.bodyFatPct}`);
  if (user?.birthDate) {
    const age = ageFromBirthDateString(user.birthDate);
    if (age != null) lines.push(`- Возраст: ~${age}`);
  }
  if (user?.sex) lines.push(`- Пол: ${user.sex}`);
  lines.push(
    "",
    "Учитывай вес тела для относительной нагрузки: bodyweight-упражнения (подтягивания, брусья, отжимания) = вес тела + добавка. Снижение добавки на 5–10 кг у тяжёлого атлета — малый % тотала, не штрафуй как сильный регресс.",
  );
  return lines.join("\n");
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Контекст для AI-тренера (Gemini structured JSON):
 *  Coach-контекст (если есть workoutId) ИЛИ детальный circuit-контекст (если
 *  circuitWorkoutId) + sleep за 7 дней + nutrition за 7 дней + история круговых.
 *  Возвращает { prompt: string } чтобы trainer route мог его сразу скормить. */
export async function buildTrainerContext(
  userId: string,
  workoutId: string | null,
  opts: { kind: AiJobKindLiteral; circuitWorkoutId?: string | null },
): Promise<{ prompt: string }> {
  const sections: string[] = [];

  sections.push(await loadAthleteProfileBlock(userId));

  if (opts.kind === "circuit_post_workout" && opts.circuitWorkoutId) {
    sections.push(
      await buildCircuitFocusedContext(userId, opts.circuitWorkoutId),
    );
  } else if (workoutId) {
    sections.push(await buildCoachContext(userId, workoutId));
  } else {
    sections.push("# Сегодня тренировки не было");
    sections.push(await loadRecentWorkoutsCompactBlock(userId, 5));
  }

  const sleep = await loadRecentSleep(userId, 14);
  sections.push(formatSleepBlock(sleep));

  const nutrition = await loadRecentNutrition(userId, 14);
  sections.push(formatNutritionBlock(nutrition));

  const cardio = await loadRecentCardio(userId, 14);
  sections.push(formatCardioBlock(cardio));

  const circuits = await loadCircuitContext(
    userId,
    CIRCUIT_HISTORY_DAYS,
    opts.circuitWorkoutId ?? null,
  );
  sections.push(formatCircuitHistoryBlock(circuits));

  sections.push(await loadScheduleBlock(userId));

  sections.push(`# Режим\nKind: \`${opts.kind}\``);

  return { prompt: sections.join("\n\n") };
}

async function loadRecentSleep(userId: string, days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return db
    .select({
      date: schema.sleepLogs.date,
      hours: schema.sleepLogs.hours,
      quality: schema.sleepLogs.quality,
      notes: schema.sleepLogs.notes,
    })
    .from(schema.sleepLogs)
    .where(
      and(
        eq(schema.sleepLogs.userId, userId),
        gte(schema.sleepLogs.date, since.toISOString().slice(0, 10)),
      ),
    )
    .orderBy(desc(schema.sleepLogs.date))
    .limit(days);
}

async function loadRecentNutrition(userId: string, days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return db
    .select({
      date: schema.nutritionEntries.date,
      kcal: schema.nutritionEntries.kcal,
      proteinG: schema.nutritionEntries.proteinG,
      fatG: schema.nutritionEntries.fatG,
      carbsG: schema.nutritionEntries.carbsG,
      notes: schema.nutritionEntries.notes,
    })
    .from(schema.nutritionEntries)
    .where(
      and(
        eq(schema.nutritionEntries.userId, userId),
        gte(schema.nutritionEntries.date, since.toISOString().slice(0, 10)),
      ),
    )
    .orderBy(desc(schema.nutritionEntries.date))
    .limit(days);
}

function formatSleepBlock(
  rows: Array<{
    date: string;
    hours: number;
    quality: number | null;
    notes: string | null;
  }>,
): string {
  if (rows.length === 0) {
    return "# Сон\n_(нет записей за последние 7 дней)_";
  }
  const avg = rows.reduce((s, r) => s + r.hours, 0) / rows.length;
  const lines = rows.map(
    (r) =>
      `- ${r.date}: ${r.hours} ч${r.quality != null ? ` · качество ${r.quality}/5` : ""}${r.notes ? ` · ${r.notes}` : ""}`,
  );
  return `# Сон (среднее ${avg.toFixed(1)} ч за ${rows.length} дн)\n\n${lines.join("\n")}`;
}

function formatNutritionBlock(
  rows: Array<{
    date: string;
    kcal: number | null;
    proteinG: number | null;
    fatG: number | null;
    carbsG: number | null;
    notes: string | null;
  }>,
): string {
  if (rows.length === 0) {
    return "# Питание\n_(нет записей за последние 7 дней)_";
  }
  const lines = rows.map((r) => {
    const macro = [
      r.kcal != null ? `${r.kcal} ккал` : null,
      r.proteinG != null ? `Б ${r.proteinG}` : null,
      r.fatG != null ? `Ж ${r.fatG}` : null,
      r.carbsG != null ? `У ${r.carbsG}` : null,
    ]
      .filter(Boolean)
      .join(" / ");
    return `- ${r.date}: ${macro || "(без макро)"}${r.notes ? ` · ${r.notes}` : ""}`;
  });
  return `# КБЖУ (${rows.length} записей за 14 дней)\n\n${lines.join("\n")}`;
}

async function loadRecentCardio(userId: string, limit: number) {
  const rows = await db
    .select({
      id: schema.cardioWorkouts.id,
      name: schema.cardioWorkouts.name,
      preset: schema.cardioWorkouts.preset,
      startedAt: schema.cardioWorkouts.startedAt,
      finishedAt: schema.cardioWorkouts.finishedAt,
      status: schema.cardioWorkouts.status,
      notes: schema.cardioWorkouts.notes,
    })
    .from(schema.cardioWorkouts)
    .where(eq(schema.cardioWorkouts.userId, userId))
    .orderBy(desc(schema.cardioWorkouts.startedAt))
    .limit(limit);

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const blocks = await db
    .select({
      cardioWorkoutId: schema.cardioBlocks.cardioWorkoutId,
      kind: schema.cardioBlocks.kind,
      plannedDurationSec: schema.cardioBlocks.plannedDurationSec,
      hrAvg: schema.cardioBlocks.hrAvg,
      rpe: schema.cardioBlocks.rpe,
      completedAt: schema.cardioBlocks.completedAt,
    })
    .from(schema.cardioBlocks)
    .where(inArray(schema.cardioBlocks.cardioWorkoutId, ids));

  const byCardio = new Map<string, typeof blocks>();
  for (const b of blocks) {
    const arr = byCardio.get(b.cardioWorkoutId) ?? [];
    arr.push(b);
    byCardio.set(b.cardioWorkoutId, arr);
  }

  return rows.map((r) => {
    const bs = byCardio.get(r.id) ?? [];
    const work = bs.filter((b) => b.kind === "work");
    const completedWork = work.filter((b) => b.completedAt != null);
    const hrs = completedWork
      .map((b) => b.hrAvg)
      .filter((v): v is number => v != null);
    const rpes = completedWork
      .map((b) => b.rpe)
      .filter((v): v is number => v != null);
    return {
      id: r.id,
      name: r.name,
      preset: r.preset,
      startedAt: r.startedAt,
      durationMin: r.finishedAt
        ? Math.round((r.finishedAt.getTime() - r.startedAt.getTime()) / 60_000)
        : null,
      status: r.status,
      notes: r.notes,
      workRounds: work.length,
      completedRounds: completedWork.length,
      hrAvg:
        hrs.length > 0
          ? Math.round(hrs.reduce((s, v) => s + v, 0) / hrs.length)
          : null,
      rpeAvg:
        rpes.length > 0
          ? +(rpes.reduce((s, v) => s + v, 0) / rpes.length).toFixed(1)
          : null,
    };
  });
}

function formatCardioBlock(
  rows: Array<{
    name: string;
    preset: string;
    startedAt: Date;
    durationMin: number | null;
    status: string;
    notes: string | null;
    workRounds: number;
    completedRounds: number;
    hrAvg: number | null;
    rpeAvg: number | null;
  }>,
): string {
  if (rows.length === 0) {
    return "# Кардио\n_(нет кардио-сессий за всё время)_";
  }
  const lines = rows.map((r) => {
    const meta = [
      `preset=${r.preset}`,
      r.durationMin != null ? `${r.durationMin} мин` : null,
      `раунды ${r.completedRounds}/${r.workRounds}`,
      r.hrAvg != null ? `HR ${r.hrAvg}` : null,
      r.rpeAvg != null ? `RPE ${r.rpeAvg}` : null,
      r.status !== "completed" ? `_${r.status}_` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const note = r.notes?.trim();
    const noteLine = note ? `\n  - заметка атлета: «${note}»` : "";
    return `- ${formatDate(r.startedAt)} · **${r.name}** · ${meta}${noteLine}`;
  });
  return `# Кардио (последние ${rows.length})\n\n${lines.join("\n")}`;
}

async function loadRecentWorkoutsCompactBlock(
  userId: string,
  limit: number,
): Promise<string> {
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
      ),
    )
    .orderBy(desc(schema.workouts.startedAt))
    .limit(limit);
  if (rows.length === 0) {
    return "_(тренировок за всё время нет)_";
  }
  return `## Последние ${rows.length} тренировок\n\n${rows
    .map((r) => `- ${formatDate(r.startedAt)}: ${r.name}`)
    .join("\n")}`;
}

// ─── Расписание (план vs факт) ────────────────────────────────────────────

const SCHEDULE_PAST_OFFSETS = [-1, -2, -3, -4, -5, -6, -7];
const SCHEDULE_UPCOMING_OFFSETS = [0, 1, 2, 3, 4, 5, 6];
const SHORT_DOW = new Map(WEEKDAYS.map((d) => [d.iso, d.short]));

/** Календарные дни юзера для offset'ов: локальная дата + ISO-день недели в его
 *  timezone. Шаг ровно 24ч (Москва без DST — дефолт; для DST-зон adherence
 *  остаётся приблизительным, R-05/R-10). */
function scheduleDayCells(now: Date, tz: string, offsets: number[]): DayCell[] {
  return offsets.map((k) => {
    const d = new Date(now.getTime() + k * 24 * 60 * 60 * 1000);
    return { date: localDateIso(d, tz), isoDay: localIsoDay(d, tz) };
  });
}

/** Timezone юзера (дефолт Europe/Moscow — как в схеме). */
async function loadUserTimezone(userId: string): Promise<string> {
  const [u] = await db
    .select({ tz: schema.users.timezone })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return u?.tz ?? "Europe/Moscow";
}

/** Включённые расписания юзера (R-7: фильтр по userId). */
async function loadEnabledSchedules(userId: string): Promise<ScheduleLite[]> {
  return db
    .select({
      label: schema.workoutSchedules.label,
      daysOfWeek: schema.workoutSchedules.daysOfWeek,
      hour: schema.workoutSchedules.hour,
    })
    .from(schema.workoutSchedules)
    .where(
      and(
        eq(schema.workoutSchedules.userId, userId),
        eq(schema.workoutSchedules.enabled, true),
      ),
    )
    .orderBy(asc(schema.workoutSchedules.hour));
}

/** Множество локальных дат с ≥1 завершённой сессией ЛЮБОГО формата за окно.
 *  Бакетим startedAt → локальную дату тем же helper'ом, что и day-cells, чтобы
 *  «план» и «факт» сравнивались в одной системе дат. */
async function loadCompletedSessionDates(
  userId: string,
  tz: string,
  sinceDays: number,
): Promise<Set<string>> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const [strength, circuits, cardio] = await Promise.all([
    db
      .select({ startedAt: schema.workouts.startedAt })
      .from(schema.workouts)
      .where(
        and(
          eq(schema.workouts.userId, userId),
          eq(schema.workouts.status, "completed"),
          gte(schema.workouts.startedAt, since),
        ),
      ),
    db
      .select({ startedAt: schema.circuitWorkouts.startedAt })
      .from(schema.circuitWorkouts)
      .where(
        and(
          eq(schema.circuitWorkouts.userId, userId),
          eq(schema.circuitWorkouts.status, "completed"),
          gte(schema.circuitWorkouts.startedAt, since),
        ),
      ),
    db
      .select({ startedAt: schema.cardioWorkouts.startedAt })
      .from(schema.cardioWorkouts)
      .where(
        and(
          eq(schema.cardioWorkouts.userId, userId),
          eq(schema.cardioWorkouts.status, "completed"),
          gte(schema.cardioWorkouts.startedAt, since),
        ),
      ),
  ]);

  const dates = new Set<string>();
  for (const r of [...strength, ...circuits, ...cardio]) {
    dates.add(localDateIso(r.startedAt, tz));
  }
  return dates;
}

/** Собирает блок «Расписание» для AI-тренера: план + план-vs-факт за 7 дней +
 *  ближайшие 7 дней. Fail-soft (R-10): любой сбой загрузки не валит весь разбор
 *  — отдаём мягкий плейсхолдер. */
async function loadScheduleBlock(userId: string): Promise<string> {
  try {
    const tz = await loadUserTimezone(userId);
    const schedules = await loadEnabledSchedules(userId);
    if (schedules.length === 0) {
      return "# Расписание тренировок\n_(расписание не задано)_";
    }
    const now = new Date();
    const completedDates = await loadCompletedSessionDates(userId, tz, 8);
    const adherence = computeScheduleAdherence(
      schedules,
      scheduleDayCells(now, tz, SCHEDULE_PAST_OFFSETS),
      scheduleDayCells(now, tz, SCHEDULE_UPCOMING_OFFSETS),
      completedDates,
    );
    return formatScheduleBlock(schedules, adherence);
  } catch {
    return "# Расписание тренировок\n_(расписание недоступно)_";
  }
}

function formatScheduleBlock(
  schedules: ScheduleLite[],
  adherence: ScheduleAdherence,
): string {
  const dow = (isoDay: number) => SHORT_DOW.get(isoDay) ?? "?";

  const plan = schedules
    .map(
      (s) => `- **${s.label}**: ${formatDays(s.daysOfWeek)} · ${formatHour(s.hour)}`,
    )
    .join("\n");

  const lines = ["# Расписание тренировок (план)", "", plan, ""];

  lines.push(
    "## План vs факт за 7 дней",
    `Запланировано тренировочных дней: ${adherence.planned7d} · выполнено: ${adherence.done7d}`,
  );
  if (adherence.missed.length > 0) {
    lines.push(
      `Пропущено: ${adherence.missed
        .map((m) => `${dow(m.isoDay)} ${m.date} (${m.labels.join(", ")})`)
        .join("; ")}`,
    );
  }

  if (adherence.upcoming.length > 0) {
    lines.push(
      "",
      "## Ближайшие 7 дней",
      adherence.upcoming
        .map(
          (u) =>
            `- ${dow(u.isoDay)} ${u.date} ${formatHour(u.hour)} — ${u.label}`,
        )
        .join("\n"),
    );
  }

  return lines.join("\n");
}

// ─── Круговые тренировки ──────────────────────────────────────────────────

type CircuitContextRow = {
  id: string;
  name: string;
  startedAt: Date;
  finishedAt: Date | null;
  status: string;
  totalRounds: number;
  exerciseCount: number;
  completedLogCount: number;
  skippedLogCount: number;
  totalDurationSec: number;
  exerciseSummaries: string[];
};

/** Грузит детальный контекст для одной конкретной круговой
 *  (используется когда AI-job kind=circuit_post_workout). */
async function buildCircuitFocusedContext(
  userId: string,
  circuitId: string,
): Promise<string> {
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

  if (!w) return "# Сегодняшняя круговая\n_(не найдена)_";

  const exercises = await db
    .select({
      id: schema.circuitExercises.id,
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

  const durationMin = w.finishedAt
    ? Math.round(
        (w.finishedAt.getTime() - w.startedAt.getTime()) / 60_000,
      )
    : null;

  const completedSlots = logs.filter((l) => !l.skipped).length;
  const skippedSlots = logs.filter((l) => l.skipped).length;
  const totalSlots = w.totalRounds * exercises.length;

  const exerciseLines: string[] = [];
  for (const ex of exercises) {
    const xs = logs
      .filter((l) => l.circuitExerciseId === ex.id)
      .sort((a, b) => a.roundNumber - b.roundNumber);
    const target =
      ex.kind === "reps"
        ? `план ${ex.targetReps ?? "?"} повт.`
        : `план ${ex.targetDurationSec ?? "?"} сек`;
    const weight =
      ex.targetWeightKg != null ? ` × ${ex.targetWeightKg} кг` : "";
    const slots = xs
      .map((l) => {
        if (l.skipped) return `${l.roundNumber}) пропуск`;
        if (ex.kind === "reps") {
          const w2 =
            l.actualWeightKg != null ? ` × ${l.actualWeightKg}кг` : "";
          const rpe = l.rpe != null ? ` @${l.rpe}` : "";
          return `${l.roundNumber}) ${l.actualReps ?? "—"} повт.${w2}${rpe}`;
        }
        const w2 =
          l.actualWeightKg != null ? ` × ${l.actualWeightKg}кг` : "";
        const rpe = l.rpe != null ? ` @${l.rpe}` : "";
        return `${l.roundNumber}) ${l.actualDurationSec ?? "—"}с${w2}${rpe}`;
      })
      .join(", ");
    exerciseLines.push(
      `- **${ex.exerciseNameRu}** (${target}${weight}): ${slots || "—"}`,
    );
  }

  return [
    `# Сегодняшняя круговая\n`,
    `**${w.name}** · ${formatDate(w.startedAt)}`,
    `Кругов план: ${w.totalRounds} · упражнений: ${exercises.length} · слотов всего: ${totalSlots}`,
    `Выполнено: ${completedSlots} · пропущено: ${skippedSlots}`,
    `Отдых: ${w.restBetweenExercisesSec}с между упр., ${w.restBetweenRoundsSec}с между кругами`,
    durationMin != null ? `Длительность: ${durationMin} мин` : "",
    w.status !== "completed" ? `_статус: ${w.status}_` : "",
    "",
    "## Упражнения и слоты:",
    ...exerciseLines,
    w.notes ? `\nЗаметка: ${w.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Грузит историю круговых за N дней (исключая текущую, если задана). */
async function loadCircuitContext(
  userId: string,
  days: number,
  excludeId: string | null,
): Promise<CircuitContextRow[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  let conditions = and(
    eq(schema.circuitWorkouts.userId, userId),
    gte(schema.circuitWorkouts.startedAt, since),
  );
  if (excludeId) {
    conditions = and(
      conditions,
      sql`${schema.circuitWorkouts.id} <> ${excludeId}`,
    );
  }

  const rows = await db
    .select()
    .from(schema.circuitWorkouts)
    .where(conditions)
    .orderBy(desc(schema.circuitWorkouts.startedAt))
    .limit(MAX_CIRCUIT_HISTORY);

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);

  const exRows = await db
    .select({
      id: schema.circuitExercises.id,
      circuitWorkoutId: schema.circuitExercises.circuitWorkoutId,
      kind: schema.circuitExercises.kind,
      targetReps: schema.circuitExercises.targetReps,
      targetDurationSec: schema.circuitExercises.targetDurationSec,
      exerciseNameRu: schema.exercises.nameRu,
    })
    .from(schema.circuitExercises)
    .innerJoin(
      schema.exercises,
      eq(schema.exercises.id, schema.circuitExercises.exerciseId),
    )
    .where(inArray(schema.circuitExercises.circuitWorkoutId, ids));

  const logRows = await db
    .select()
    .from(schema.circuitRoundLogs)
    .where(inArray(schema.circuitRoundLogs.circuitWorkoutId, ids));

  const exByCircuit = new Map<string, typeof exRows>();
  for (const ex of exRows) {
    const arr = exByCircuit.get(ex.circuitWorkoutId) ?? [];
    arr.push(ex);
    exByCircuit.set(ex.circuitWorkoutId, arr);
  }

  const logsByCircuit = new Map<string, typeof logRows>();
  for (const l of logRows) {
    const arr = logsByCircuit.get(l.circuitWorkoutId) ?? [];
    arr.push(l);
    logsByCircuit.set(l.circuitWorkoutId, arr);
  }

  return rows.map((w) => {
    const exs = exByCircuit.get(w.id) ?? [];
    const lgs = logsByCircuit.get(w.id) ?? [];
    const completed = lgs.filter((l) => !l.skipped).length;
    const skipped = lgs.filter((l) => l.skipped).length;
    const totalSec = lgs.reduce(
      (s, l) => s + (l.actualDurationSec ?? 0),
      0,
    );
    return {
      id: w.id,
      name: w.name,
      startedAt: w.startedAt,
      finishedAt: w.finishedAt,
      status: w.status,
      totalRounds: w.totalRounds,
      exerciseCount: exs.length,
      completedLogCount: completed,
      skippedLogCount: skipped,
      totalDurationSec: totalSec,
      exerciseSummaries: exs.map(
        (e) =>
          `${e.exerciseNameRu} (${e.kind === "reps" ? `${e.targetReps ?? "?"} повт.` : `${e.targetDurationSec ?? "?"}с`})`,
      ),
    };
  });
}

function formatCircuitHistoryBlock(rows: CircuitContextRow[]): string {
  if (rows.length === 0) {
    return "# Круговые тренировки\n_(нет круговых за последние 60 дней)_";
  }
  const lines = rows.map((r) => {
    const expected = r.totalRounds * r.exerciseCount;
    const durationMin =
      r.finishedAt != null
        ? Math.round(
            (r.finishedAt.getTime() - r.startedAt.getTime()) / 60_000,
          )
        : null;
    const meta = [
      `${r.totalRounds} × ${r.exerciseCount} упр.`,
      `выполнено ${r.completedLogCount}/${expected}`,
      r.skippedLogCount > 0 ? `пропусков ${r.skippedLogCount}` : null,
      durationMin != null ? `${durationMin} мин` : null,
      r.status !== "completed" ? `_${r.status}_` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const exs =
      r.exerciseSummaries.length > 0
        ? `\n  упр.: ${r.exerciseSummaries.join("; ")}`
        : "";
    return `- ${formatDate(r.startedAt)} · **${r.name}** · ${meta}${exs}`;
  });
  return `# Круговые тренировки за последние 60 дней (${rows.length})\n\n${lines.join("\n")}`;
}
