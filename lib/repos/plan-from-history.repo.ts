import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  buildNextTemplateItems,
  templateItemsFromWorkout,
  type NextTemplateItem,
} from "@/lib/domain/templates/next-template";
import {
  DEFAULT_MYO_MINI_SETS,
  DEFAULT_MYO_FIRST_REST_SECONDS,
  DEFAULT_MYO_REPS_PERCENT,
  DEFAULT_MYO_REST_SECONDS,
} from "@/lib/domain/workouts/myo-reps";
import { getActiveWorkoutForUser } from "@/lib/repos/workouts.repo";

/** «Собери план / шаблон прямо из истории тренировок». Атлет тренируется по
 *  факту (ad-hoc, без шаблонов) — но хочет превратить сделанное в повторяемый
 *  план. Здесь: завершённая тренировка → шаблон (точная передача выполненного,
 *  templateItemsFromWorkout), и набор тренировок → программа (по дню на
 *  тренировку). R-7: getActiveWorkoutForUser гейтит по userId; чужая/активная →
 *  пропускается. */

/** Загружает выполненную силовую и строит из неё элементы шаблона (факт, без
 *  прогрессии). null — тренировка не найдена/не завершена/без рабочих подходов. */
async function itemsFromWorkout(
  userId: string,
  workoutId: string,
): Promise<{ name: string; items: NextTemplateItem[] } | null> {
  const w = await getActiveWorkoutForUser(userId, workoutId);
  if (!w || w.status !== "completed") return null;
  const items = templateItemsFromWorkout(
    w.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      sets: e.sets,
      setScheme: e.setScheme,
      myoMiniSets: e.myoMiniSets,
      myoRepsPercent: e.myoRepsPercent,
      myoRestSeconds: e.myoRestSeconds,
      myoFirstRestSeconds: e.myoFirstRestSeconds,
    })),
  );
  if (items.length === 0) return null;
  return { name: w.name, items };
}

function insertItems(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  templateId: string,
  items: NextTemplateItem[],
) {
  return tx.insert(schema.templateExercises).values(
    items.map((it, i) => ({
      templateId,
      exerciseId: it.exerciseId,
      position: i,
      targetSets: it.targetSets,
      targetRepsMin: it.targetRepsMin,
      targetRepsMax: it.targetRepsMax,
      targetWeightKg: it.targetWeightKg,
      targetRestSeconds: it.targetRestSeconds,
      setScheme: it.setScheme ?? "straight",
      myoMiniSets: it.myoMiniSets ?? DEFAULT_MYO_MINI_SETS,
      myoRepsPercent: it.myoRepsPercent ?? DEFAULT_MYO_REPS_PERCENT,
      myoRestSeconds: it.myoRestSeconds ?? DEFAULT_MYO_REST_SECONDS,
      myoFirstRestSeconds:
        it.myoFirstRestSeconds ?? DEFAULT_MYO_FIRST_REST_SECONDS,
    })),
  );
}

/** Одна завершённая тренировка → одиночный силовой шаблон. Возвращает id или
 *  null (нечего сохранять). Имя — из тренировки, если не задано своё. */
export async function createTemplateFromWorkout(
  userId: string,
  workoutId: string,
  name?: string,
): Promise<{ id: string } | null> {
  const day = await itemsFromWorkout(userId, workoutId);
  if (!day) return null;

  return db.transaction(async (tx) => {
    const id = crypto.randomUUID();
    await tx.insert(schema.workoutTemplates).values({
      id,
      userId,
      name: (name?.trim() || day.name).slice(0, 80),
      source: "manual",
    });
    await insertItems(tx, id, day.items);
    return { id };
  });
}

export type NextWorkoutPreviewItem = {
  exerciseId: string;
  nameRu: string;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  targetWeightKg: number | null;
};

/** Превью «следующей тренировки от тренера» из завершённой: прогрессия по факту
 *  (buildNextTemplateItems — добавляет вес/повторы) + имена упражнений для показа.
 *  Пусто, если тренировка не найдена/не завершена/без рабочих подходов. Это то,
 *  что атлет видит в истории ДО старта скорректированной тренировки. */
export async function nextWorkoutPreview(
  userId: string,
  workoutId: string,
): Promise<NextWorkoutPreviewItem[]> {
  const w = await getActiveWorkoutForUser(userId, workoutId);
  if (!w || w.status !== "completed") return [];
  const nameById = new Map(w.exercises.map((e) => [e.exerciseId, e.exerciseNameRu]));
  return buildNextTemplateItems(
    w.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      sets: e.sets,
      setScheme: e.setScheme,
      myoMiniSets: e.myoMiniSets,
      myoRepsPercent: e.myoRepsPercent,
      myoRestSeconds: e.myoRestSeconds,
      myoFirstRestSeconds: e.myoFirstRestSeconds,
    })),
  ).map((it) => ({
    exerciseId: it.exerciseId,
    nameRu: nameById.get(it.exerciseId) ?? "Упражнение",
    targetSets: it.targetSets,
    targetRepsMin: it.targetRepsMin,
    targetRepsMax: it.targetRepsMax,
    targetWeightKg: it.targetWeightKg,
  }));
}

/** Get-or-create шаблон «следующая тренировка от тренера» по завершённой:
 *  прогрессия по факту (buildNextTemplateItems). Идемпотентно по sourceWorkoutId
 *  (source='trainer') — повторные заходы переиспользуют один шаблон, а не плодят
 *  копии. Отсюда стартует «скорректированная тренировка» прямо из истории —
 *  работает и для ad-hoc (без исходного шаблона). null — нечего прогрессировать.
 *  R-7: getActiveWorkoutForUser гейтит по userId. */
export async function getOrCreateNextWorkoutTemplate(
  userId: string,
  workoutId: string,
): Promise<{ id: string } | null> {
  const [existing] = await db
    .select({ id: schema.workoutTemplates.id })
    .from(schema.workoutTemplates)
    .where(
      and(
        eq(schema.workoutTemplates.userId, userId),
        eq(schema.workoutTemplates.source, "trainer"),
        eq(schema.workoutTemplates.sourceWorkoutId, workoutId),
        isNull(schema.workoutTemplates.archivedAt),
      ),
    )
    .limit(1);
  if (existing) return existing;

  const w = await getActiveWorkoutForUser(userId, workoutId);
  if (!w || w.status !== "completed") return null;
  const items = buildNextTemplateItems(
    w.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      sets: e.sets,
      setScheme: e.setScheme,
      myoMiniSets: e.myoMiniSets,
      myoRepsPercent: e.myoRepsPercent,
      myoRestSeconds: e.myoRestSeconds,
      myoFirstRestSeconds: e.myoFirstRestSeconds,
    })),
  );
  if (items.length === 0) return null;

  return db.transaction(async (tx) => {
    const id = crypto.randomUUID();
    await tx.insert(schema.workoutTemplates).values({
      id,
      userId,
      name: w.name.slice(0, 80),
      source: "trainer",
      sourceWorkoutId: workoutId,
    });
    await insertItems(tx, id, items);
    return { id };
  });
}

/** Несколько завершённых тренировок → тренировочная программа (по дню на
 *  тренировку, в переданном порядке). Активна сразу — дни появляются в
 *  «Шаблонах». Тренировки без рабочих подходов пропускаются. Кидает, если после
 *  фильтра не осталось ни одного дня (вызыватель показывает ошибку, R-37). */
export async function createProgramFromWorkouts(
  userId: string,
  input: { name: string; workoutIds: string[] },
): Promise<{ id: string }> {
  const days: { name: string; items: NextTemplateItem[] }[] = [];
  for (const wid of input.workoutIds) {
    const day = await itemsFromWorkout(userId, wid);
    if (day) days.push(day);
  }
  if (days.length === 0) {
    throw new Error(
      "Из выбранных тренировок не удалось собрать план — в них нет рабочих подходов.",
    );
  }

  return db.transaction(async (tx) => {
    const programId = crypto.randomUUID();
    await tx.insert(schema.trainingPrograms).values({
      id: programId,
      userId,
      name: input.name.slice(0, 80),
      activatedAt: new Date(),
    });

    for (const [dayOrder, day] of days.entries()) {
      const templateId = crypto.randomUUID();
      await tx.insert(schema.workoutTemplates).values({
        id: templateId,
        userId,
        name: day.name.slice(0, 80),
        programId,
        dayOrder,
        source: "manual",
      });
      await insertItems(tx, templateId, day.items);
    }

    return { id: programId };
  });
}
