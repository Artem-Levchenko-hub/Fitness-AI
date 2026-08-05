import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  dedupInsightInputs,
  type InsightQueryInput,
} from "@/lib/ai/insight-query";
import { resumeCutoff } from "@/lib/domain";
import { extractOverallScore } from "@/lib/domain/friends/friend-score";

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
  exerciseSlug: string;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  targetWeightKg: number | null;
  targetRestSeconds: number;
  /** Миорепс-протокол упражнения (см. lib/domain/workouts/myo.ts). */
  myoReps: boolean;
  myoMiniSets: number;
  myoMiniReps: number;
  myoMiniRestSeconds: number;
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
  opts?: { clientWorkoutId?: string | null },
): Promise<{ id: string }> {
  const clientWorkoutId = opts?.clientWorkoutId ?? null;
  return db.transaction(async (tx) => {
    // H15.3c-2 — идемпотентность офлайн-старта: реплей того же clientWorkoutId
    // при повторном дренаже outbox находит уже созданную тренировку и НЕ плодит
    // дубль. Проверка ДО отмены активных/вставки — повторный дренаж не должен
    // переотменять/пересоздавать. Онлайн-старт: clientWorkoutId=null, сюда не
    // заходит → поведение не меняется (столп 4).
    if (clientWorkoutId) {
      const [existing] = await tx
        .select({ id: schema.workouts.id })
        .from(schema.workouts)
        .where(
          and(
            eq(schema.workouts.userId, userId),
            eq(schema.workouts.clientWorkoutId, clientWorkoutId),
          ),
        )
        .limit(1);
      if (existing) return { id: existing.id };
    }

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

    // Один активный сеанс на формат: закрываем брошенные active-силовые юзера,
    // чтобы resume-баннер не «висел» (G2) — незавершённые сессии иначе копятся.
    await tx
      .update(schema.workouts)
      .set({ status: "cancelled", finishedAt: new Date() })
      .where(
        and(
          eq(schema.workouts.userId, userId),
          eq(schema.workouts.status, "active"),
        ),
      );

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
      clientWorkoutId,
    });

    if (tplItems.length > 0) {
      await tx.insert(schema.workoutExercises).values(
        tplItems.map((it) => ({
          workoutId,
          exerciseId: it.exerciseId,
          position: it.position,
          notes: it.notes,
          // Снимок назначения на СТАРТ: следующие правки шаблона тренером
          // относятся к следующей сессии и не меняют уже открытую тренировку.
          targetSets: it.targetSets,
          targetRepsMin: it.targetRepsMin,
          targetRepsMax: it.targetRepsMax,
          targetWeightKg: it.targetWeightKg,
          targetRestSeconds: it.targetRestSeconds,
          myoReps: it.myoReps,
          myoMiniSets: it.myoMiniSets,
          myoMiniReps: it.myoMiniReps,
          myoMiniRestSeconds: Math.min(30, it.myoMiniRestSeconds),
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
      exerciseSlug: schema.exercises.slug,
      targetSets: schema.workoutExercises.targetSets,
      targetRepsMin: schema.workoutExercises.targetRepsMin,
      targetRepsMax: schema.workoutExercises.targetRepsMax,
      targetWeightKg: schema.workoutExercises.targetWeightKg,
      targetRestSeconds: schema.workoutExercises.targetRestSeconds,
      myoReps: schema.workoutExercises.myoReps,
      myoMiniSets: schema.workoutExercises.myoMiniSets,
      myoMiniReps: schema.workoutExercises.myoMiniReps,
      myoMiniRestSeconds: schema.workoutExercises.myoMiniRestSeconds,
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
      myoReps: boolean;
      myoMiniSets: number;
      myoMiniReps: number;
      myoMiniRestSeconds: number;
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
        myoReps: schema.templateExercises.myoReps,
        myoMiniSets: schema.templateExercises.myoMiniSets,
        myoMiniReps: schema.templateExercises.myoMiniReps,
        myoMiniRestSeconds: schema.templateExercises.myoMiniRestSeconds,
      })
      .from(schema.templateExercises)
      .where(eq(schema.templateExercises.templateId, w.templateId));
    for (const it of tplItems) templateTargets.set(it.exerciseId, it);
  }

  const exercises: ActiveWorkoutExercise[] = exerciseRows.map((r) => {
    const t = templateTargets.get(r.exerciseId);
    // targetSets — маркер полного snapshot: вес может быть честным null,
    // поэтому им нельзя определять legacy-сессию.
    const snapshot = r.targetSets != null;
    return {
      ...r,
      targetSets: snapshot ? r.targetSets! : (t?.targetSets ?? 3),
      targetRepsMin: snapshot ? r.targetRepsMin! : (t?.targetRepsMin ?? 8),
      targetRepsMax: snapshot ? r.targetRepsMax! : (t?.targetRepsMax ?? 12),
      targetWeightKg: snapshot ? r.targetWeightKg : (t?.targetWeightKg ?? null),
      targetRestSeconds: snapshot
        ? r.targetRestSeconds!
        : (t?.targetRestSeconds ?? 120),
      myoReps: snapshot ? r.myoReps! : (t?.myoReps ?? false),
      myoMiniSets: snapshot ? r.myoMiniSets! : (t?.myoMiniSets ?? 3),
      myoMiniReps: snapshot ? r.myoMiniReps! : (t?.myoMiniReps ?? 5),
      myoMiniRestSeconds: Math.min(
        30,
        snapshot ? r.myoMiniRestSeconds! : (t?.myoMiniRestSeconds ?? 20),
      ),
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
  /** Стабильный client-UUID офлайн-подхода (H15.3 outbox). Передаётся при
   *  реплее буферизованной записи — partial-unique делает повтор no-op
   *  (онлайн-путь не передаёт → NULL → обычная вставка). */
  clientSetId?: string | null;
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

    await tx
      .insert(schema.workoutSets)
      .values({
        workoutExerciseId: input.workoutExerciseId,
        setIndex: input.setIndex,
        setType: input.setType ?? "working",
        weightKg: input.weightKg,
        reps: input.reps,
        rpe: input.rpe ?? null,
        restSeconds: input.restSeconds ?? null,
        clientSetId: input.clientSetId ?? null,
        completedAt: new Date(),
      })
      // Реплей одного и того же офлайн-подхода (тот же clientSetId) — no-op:
      // дренаж outbox идемпотентен (H15.4). Онлайн-путь даёт clientSetId=null,
      // partial-unique его исключает → конфликта нет, обычная вставка.
      .onConflictDoNothing({
        target: schema.workoutSets.clientSetId,
        where: sql`${schema.workoutSets.clientSetId} is not null`,
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
      .select({
        workoutId: schema.workoutExercises.workoutId,
        workoutExerciseId: schema.workoutExercises.id,
        setIndex: schema.workoutSets.setIndex,
        snapshotMyoReps: schema.workoutExercises.myoReps,
        templateMyoReps: schema.templateExercises.myoReps,
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
      .leftJoin(
        schema.templateExercises,
        and(
          eq(schema.templateExercises.templateId, schema.workouts.templateId),
          eq(schema.templateExercises.exerciseId, schema.workoutExercises.exerciseId),
        ),
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

    // Протокол Myo зависит от единственного активационного подхода. Нельзя
    // удалить его или середину кластера через старую вкладку/прямой action:
    // сначала удаляется последний мини-сет, затем предыдущий. Snapshot —
    // источник для новых сессий, template — безопасный fallback для legacy.
    const isMyo = chk.snapshotMyoReps ?? chk.templateMyoReps ?? false;
    if (isMyo) {
      const [laterSet] = await tx
        .select({ id: schema.workoutSets.id })
        .from(schema.workoutSets)
        .where(
          and(
            eq(schema.workoutSets.workoutExerciseId, chk.workoutExerciseId),
            gt(schema.workoutSets.setIndex, chk.setIndex),
          ),
        )
        .limit(1);
      if (laterSet) {
        throw new Error("В Myo-reps можно удалить только последний подход");
      }
    }

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

/** Отменяет брошенную активную силовую сессию (status active → cancelled),
 *  чтобы resume-баннер не «висел» вечно (H2). Зеркало cancelCardio/Circuit:
 *  фильтр active + userId (R-7) делает вызов идемпотентным — повторный тап или
 *  уже-завершённая сессия дают 0 строк без ошибки. Прогресс остаётся в БД как
 *  cancelled (в историю/статистику не идёт, как у других форматов). */
export async function cancelWorkout(
  userId: string,
  workoutId: string,
): Promise<void> {
  await db
    .update(schema.workouts)
    .set({
      status: "cancelled",
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

/** Удаляет тренировку целиком. Дочерние строки (упражнения, подходы,
 *  AI-анализы, AI-задачи, заметки) уходят по ON DELETE CASCADE. Фильтр по
 *  userId (R-7) — чужую тренировку удалить нельзя (0 строк). */
export async function deleteWorkout(
  userId: string,
  workoutId: string,
): Promise<void> {
  await db
    .delete(schema.workouts)
    .where(
      and(
        eq(schema.workouts.id, workoutId),
        eq(schema.workouts.userId, userId),
      ),
    );
}

/** Сохраняет заметку к тренировке — самочувствие атлета, записанное перед
 *  завершением. `source`: "manual" — атлет напечатал текст; "auto_generated" —
 *  заметка собрана из тапа (pliability). AI-тренер читает workout_notes целиком
 *  при разборе. */
export async function saveWorkoutNote(
  userId: string,
  workoutId: string,
  content: string,
  source: "manual" | "auto_generated" = "manual",
): Promise<void> {
  await db.insert(schema.workoutNotes).values({
    userId,
    workoutId,
    content,
    source,
  });
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

/** Оценки ИИ-тренера (overallScore 0..100) по списку тренировок — для бейджа
 *  «оценка» у друга, когда тот делится программами. Берём СВЕЖАЙШИЙ разбор на
 *  тренировку (rows по createdAt desc, первый встреченный workoutId — он же
 *  актуальный) и извлекаем оценку чистым extractOverallScore (R-04 переиспользуем
 *  в любом контексте — друг/своя история). R-7: фильтр по userId — оценки только
 *  владельца тренировок. Тренировки без числовой оценки в Map не попадают. */
export async function listWorkoutScores(
  userId: string,
  workoutIds: string[],
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  if (workoutIds.length === 0) return scores;

  const rows = await db
    .select({
      workoutId: schema.aiAnalyses.workoutId,
      resultJson: schema.aiAnalyses.resultJson,
    })
    .from(schema.aiAnalyses)
    .where(
      and(
        eq(schema.aiAnalyses.userId, userId),
        inArray(schema.aiAnalyses.workoutId, workoutIds),
      ),
    )
    .orderBy(desc(schema.aiAnalyses.createdAt));

  const seen = new Set<string>();
  for (const r of rows) {
    if (!r.workoutId || seen.has(r.workoutId)) continue;
    seen.add(r.workoutId); // свежайший разбор тренировки — авторитетный
    const score = extractOverallScore(r.resultJson);
    if (score != null) scores.set(r.workoutId, score);
  }
  return scores;
}

export async function getAiAnalysisForWorkout(
  userId: string,
  workoutId: string,
): Promise<{
  id: string;
  content: string;
  resultJson: unknown;
  modelVersion: string;
  createdAt: Date;
} | null> {
  const [row] = await db
    .select({
      id: schema.aiAnalyses.id,
      content: schema.aiAnalyses.content,
      resultJson: schema.aiAnalyses.resultJson,
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

/** Последний разбор тренировки со structured resultJson (для TrainerResultCard).
 *  Отличается от getAiAnalysisForWorkout: тянет resultJson (цветные дельты F4).
 *  Используется stream-консьюмером F8: после стрима перечитать сохранённый разбор. */
export async function getLatestTrainerResult(
  userId: string,
  workoutId: string,
): Promise<{
  id: string;
  resultJson: unknown;
  modelVersion: string;
  createdAt: Date;
  shareToken: string | null;
} | null> {
  const [row] = await db
    .select({
      id: schema.aiAnalyses.id,
      resultJson: schema.aiAnalyses.resultJson,
      modelVersion: schema.aiAnalyses.modelVersion,
      createdAt: schema.aiAnalyses.createdAt,
      shareToken: schema.aiAnalyses.shareToken,
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

/** H13.5 — ref на свежайший ПРОШЛЫЙ разбор атлета ТОГО ЖЕ формата (тот же ряд,
 *  что кормит «# Память тренера» H5.5) для ссылки из блока «Прошлый совет».
 *  Зеркалит format-фильтр `loadTrainerMemoryBlock` (силовая = workoutId есть &
 *  circuit null; круговая = circuitWorkoutId есть; digest = оба null), исключает
 *  текущую тренировку и берёт ТОП по createdAt — ту же запись, что тренер
 *  цитирует в pastAdviceFollowUp. R-7 — явный userId. fail-soft (R-10): любой
 *  сбой → null, заголовок «Прошлый совет» остаётся статичным (R-37). */
export async function getPreviousAnalysisRef(
  userId: string,
  format: "strength" | "circuit" | "digest",
  exclude: { workoutId?: string | null; circuitWorkoutId?: string | null },
): Promise<{ workoutId: string | null; circuitWorkoutId: string | null } | null> {
  try {
    const a = schema.aiAnalyses;
    const formatFilter =
      format === "circuit"
        ? isNotNull(a.circuitWorkoutId)
        : format === "digest"
          ? and(isNull(a.workoutId), isNull(a.circuitWorkoutId))
          : and(isNotNull(a.workoutId), isNull(a.circuitWorkoutId));

    const conditions = [eq(a.userId, userId), formatFilter];
    if (exclude.workoutId) conditions.push(ne(a.workoutId, exclude.workoutId));
    if (exclude.circuitWorkoutId)
      conditions.push(ne(a.circuitWorkoutId, exclude.circuitWorkoutId));

    const [row] = await db
      .select({ workoutId: a.workoutId, circuitWorkoutId: a.circuitWorkoutId })
      .from(a)
      .where(and(...conditions))
      .orderBy(desc(a.createdAt))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

/** H8.2c — последний авто-сгенерированный недельный разбор (kind='weekly_review')
 *  для показа на /stats. Воркер H8.2 пишет TrainerResponse в ai_analyses
 *  (workoutId null) и проставляет ai_jobs.analysisId; различаем weekly от
 *  per-workout/digest через ai_jobs.kind. innerJoin по analysisId + явный
 *  userId на ai_jobs (R-7 — нет RLS, фильтруем сами). null, если воркер ещё ни
 *  разу не закрыл неделю этому юзеру. */
export async function getLatestWeeklyReview(
  userId: string,
): Promise<{ id: string; resultJson: unknown; createdAt: Date } | null> {
  const [row] = await db
    .select({
      id: schema.aiAnalyses.id,
      resultJson: schema.aiAnalyses.resultJson,
      createdAt: schema.aiAnalyses.createdAt,
    })
    .from(schema.aiJobs)
    .innerJoin(
      schema.aiAnalyses,
      eq(schema.aiAnalyses.id, schema.aiJobs.analysisId),
    )
    .where(
      and(
        eq(schema.aiJobs.userId, userId),
        eq(schema.aiJobs.kind, "weekly_review"),
        eq(schema.aiJobs.status, "succeeded"),
      ),
    )
    .orderBy(desc(schema.aiJobs.scheduledAt))
    .limit(1);
  return row ?? null;
}

/** H11.1b «Память недельного тренера»: свежайший succeeded weekly_review со
 *  `scheduledAt` СТРОГО ДО `before` — границы текущей ISO-недели. Без границы
 *  (как getLatestWeeklyReview) verification-протокол форсит weekly_review ТЕКУЩЕЙ
 *  недели и она же стала бы «прошлым» → тренер процитировал бы same-week дубль.
 *  Тот же innerJoin ai_jobs(kind=weekly_review, succeeded) (R-7 userId на ai_jobs,
 *  отсекает digest c workoutId/circuitWorkoutId null). null — предшественника
 *  нет (первый weekly). fail-soft (R-10): сбой → null, разбор не падает. */
export async function getPreviousWeeklyReview(
  userId: string,
  before: Date,
): Promise<{ resultJson: unknown; createdAt: Date } | null> {
  try {
    const [row] = await db
      .select({
        resultJson: schema.aiAnalyses.resultJson,
        createdAt: schema.aiAnalyses.createdAt,
      })
      .from(schema.aiJobs)
      .innerJoin(
        schema.aiAnalyses,
        eq(schema.aiAnalyses.id, schema.aiJobs.analysisId),
      )
      .where(
        and(
          eq(schema.aiJobs.userId, userId),
          eq(schema.aiJobs.kind, "weekly_review"),
          eq(schema.aiJobs.status, "succeeded"),
          lt(schema.aiJobs.scheduledAt, before),
        ),
      )
      .orderBy(desc(schema.aiJobs.scheduledAt))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

/** H5.7 «совет→следующая сессия»: последний разбор ПРЕДЫДУЩЕЙ тренировки этого
 *  шаблона (любой завершённой — наличие ai_analysis уже означает завершение).
 *  Возвращает сырую строку; извлечение nextSessionFocus делает вызывающий через
 *  extractPastAdvice (R-7: repo не знает про формат AI-JSON). null, если по этому
 *  шаблону ещё не было ни одного разобранного прогона. */
export async function getLastTemplateAnalysis(
  userId: string,
  templateId: string,
): Promise<{ id: string; resultJson: unknown; createdAt: Date } | null> {
  const [row] = await db
    .select({
      id: schema.aiAnalyses.id,
      resultJson: schema.aiAnalyses.resultJson,
      createdAt: schema.aiAnalyses.createdAt,
    })
    .from(schema.aiAnalyses)
    .innerJoin(
      schema.workouts,
      eq(schema.workouts.id, schema.aiAnalyses.workoutId),
    )
    .where(
      and(
        eq(schema.aiAnalyses.userId, userId),
        eq(schema.workouts.templateId, templateId),
      ),
    )
    .orderBy(desc(schema.aiAnalyses.createdAt))
    .limit(1);
  return row ?? null;
}

/** H11.2 «голос тренера на /dashboard»: свежайший per-workout разбор атлета
 *  (силовой `workoutId` ЛИБО круговой `circuitWorkoutId`), созданный не раньше
 *  `since` (окно «свежести», обычно 7 дней). Возвращает сырой resultJson + FK —
 *  focus и ссылку резолвит вызывающий (R-7: repo не знает AI-формат).
 *  null, если свежего per-workout разбора нет → вызывающий падает на недельный
 *  fallback. fail-soft (R-10): сбой → null, дашборд не падает. */
export async function getLatestPerWorkoutAnalysis(
  userId: string,
  since: Date,
): Promise<{
  id: string;
  resultJson: unknown;
  createdAt: Date;
  workoutId: string | null;
  circuitWorkoutId: string | null;
} | null> {
  try {
    const a = schema.aiAnalyses;
    const [row] = await db
      .select({
        id: a.id,
        resultJson: a.resultJson,
        createdAt: a.createdAt,
        workoutId: a.workoutId,
        circuitWorkoutId: a.circuitWorkoutId,
      })
      .from(a)
      .where(
        and(
          eq(a.userId, userId),
          or(isNotNull(a.workoutId), isNotNull(a.circuitWorkoutId)),
          gte(a.createdAt, since),
        ),
      )
      .orderBy(desc(a.createdAt))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

/** Включить публичный шеринг разбора. R-7: правит только СВОЙ разбор
 *  (фильтр по userId). Идемпотентно — повторный вызов возвращает тот же
 *  токен (не перевыпускаем, чтобы старая ссылка не протухла). Возвращает
 *  capability-токен либо null, если разбор не найден / не принадлежит юзеру. */
export async function enableAnalysisSharing(
  userId: string,
  analysisId: string,
): Promise<string | null> {
  const [existing] = await db
    .select({ shareToken: schema.aiAnalyses.shareToken })
    .from(schema.aiAnalyses)
    .where(
      and(
        eq(schema.aiAnalyses.id, analysisId),
        eq(schema.aiAnalyses.userId, userId),
      ),
    )
    .limit(1);
  if (!existing) return null;
  if (existing.shareToken) return existing.shareToken;

  const token = crypto.randomUUID();
  await db
    .update(schema.aiAnalyses)
    .set({ shareToken: token })
    .where(
      and(
        eq(schema.aiAnalyses.id, analysisId),
        eq(schema.aiAnalyses.userId, userId),
      ),
    );
  return token;
}

/** Отключить публичный шеринг (сбросить токен). R-7: только свой разбор.
 *  Возвращает true, если строка обновлена. */
export async function disableAnalysisSharing(
  userId: string,
  analysisId: string,
): Promise<boolean> {
  const rows = await db
    .update(schema.aiAnalyses)
    .set({ shareToken: null })
    .where(
      and(
        eq(schema.aiAnalyses.id, analysisId),
        eq(schema.aiAnalyses.userId, userId),
      ),
    )
    .returning({ id: schema.aiAnalyses.id });
  return rows.length > 0;
}

/** Публичное чтение расшаренного разбора по capability-токену.
 *  СОЗНАТЕЛЬНОЕ R-7-исключение: сам токен (unguessable UUID) — это право
 *  доступа, поэтому НЕТ фильтра по userId. Отдаём только non-PII поля
 *  (никакого userId / email). null, если токен пустой или не найден. */
export async function getSharedAnalysis(token: string): Promise<{
  content: string;
  resultJson: unknown;
  modelVersion: string;
  createdAt: Date;
} | null> {
  if (!token) return null;
  const [row] = await db
    .select({
      content: schema.aiAnalyses.content,
      resultJson: schema.aiAnalyses.resultJson,
      modelVersion: schema.aiAnalyses.modelVersion,
      createdAt: schema.aiAnalyses.createdAt,
    })
    .from(schema.aiAnalyses)
    .where(eq(schema.aiAnalyses.shareToken, token))
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
        // H2.2b: брошенная сессия старше окна не всплывает как resume-фантом.
        gte(schema.workouts.startedAt, resumeCutoff(new Date())),
      ),
    )
    .orderBy(desc(schema.workouts.startedAt))
    .limit(1);
  return row?.id ?? null;
}

/** H16.1 — мышцы + EN-имена упражнений силовой тренировки для построения
 *  RAG-запроса «книжных фактов под сессию» (buildInsightQuery). R-7: владелец
 *  тренировки гейтится явным userId — чужой/несуществующий workoutId → null
 *  (роут отдаёт пустые карточки, не утечку). Возвращает уже дедуплицированные
 *  ключи групп мышц (primary+secondary) и nameEn упражнений сессии. */
export async function loadWorkoutInsightInputs(
  userId: string,
  workoutId: string,
): Promise<InsightQueryInput | null> {
  const [owned] = await db
    .select({ id: schema.workouts.id })
    .from(schema.workouts)
    .where(
      and(
        eq(schema.workouts.id, workoutId),
        eq(schema.workouts.userId, userId),
      ),
    )
    .limit(1);
  if (!owned) return null;

  const rows = await db
    .select({
      nameEn: schema.exercises.nameEn,
      muscleGroupKey: schema.exerciseMuscleGroups.muscleGroupKey,
    })
    .from(schema.workoutExercises)
    .innerJoin(
      schema.exercises,
      eq(schema.exercises.id, schema.workoutExercises.exerciseId),
    )
    .leftJoin(
      schema.exerciseMuscleGroups,
      eq(schema.exerciseMuscleGroups.exerciseId, schema.workoutExercises.exerciseId),
    )
    .where(eq(schema.workoutExercises.workoutId, workoutId));

  return dedupInsightInputs(rows);
}

/**
 * H16.3 — «книжные факты под сессию» для КРУГОВОЙ (зеркало
 * loadWorkoutInsightInputs): круговая ожидает разбор на /circuits/[id] и
 * получает тот же лоадер с фактами. R-7: владелец круговой гейтится по userId
 * (чужой/нет → null → пустые карточки). Источник мышц/имён — circuit_exercises
 * → exercises.nameEn + exercise_muscle_groups (у круговой свои упражнения-дети,
 * не workout_exercises).
 */
export async function loadCircuitInsightInputs(
  userId: string,
  circuitWorkoutId: string,
): Promise<InsightQueryInput | null> {
  const [owned] = await db
    .select({ id: schema.circuitWorkouts.id })
    .from(schema.circuitWorkouts)
    .where(
      and(
        eq(schema.circuitWorkouts.id, circuitWorkoutId),
        eq(schema.circuitWorkouts.userId, userId),
      ),
    )
    .limit(1);
  if (!owned) return null;

  const rows = await db
    .select({
      nameEn: schema.exercises.nameEn,
      muscleGroupKey: schema.exerciseMuscleGroups.muscleGroupKey,
    })
    .from(schema.circuitExercises)
    .innerJoin(
      schema.exercises,
      eq(schema.exercises.id, schema.circuitExercises.exerciseId),
    )
    .leftJoin(
      schema.exerciseMuscleGroups,
      eq(
        schema.exerciseMuscleGroups.exerciseId,
        schema.circuitExercises.exerciseId,
      ),
    )
    .where(eq(schema.circuitExercises.circuitWorkoutId, circuitWorkoutId));

  return dedupInsightInputs(rows);
}
