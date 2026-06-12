import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { resumeCutoff } from "@/lib/domain";

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

/** Сохраняет ручную заметку к тренировке — самочувствие атлета, записанное
 *  перед завершением. AI-тренер читает workout_notes целиком при разборе. */
export async function saveManualWorkoutNote(
  userId: string,
  workoutId: string,
  content: string,
): Promise<void> {
  await db.insert(schema.workoutNotes).values({
    userId,
    workoutId,
    content,
    source: "manual",
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
