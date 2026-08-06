import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  buildNextTemplateItems,
  templateItemsFromWorkout,
  type NextTemplateItem,
} from "@/lib/domain/templates/next-template";
import { exerciseSetHistory } from "@/lib/repos/stats.repo";
import { getActiveWorkoutForUser } from "@/lib/repos/workouts.repo";

const DEFAULT_REST_SECONDS = 120;

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
      myoReps: e.myoReps,
      myoMiniSets: e.myoMiniSets,
      myoMiniReps: e.myoMiniReps,
      myoMiniRestSeconds: e.myoMiniRestSeconds,
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
      ...(it.myoReps
        ? {
            myoReps: true,
            myoMiniSets: it.myoMiniSets,
            myoMiniReps: it.myoMiniReps,
            myoMiniRestSeconds: it.myoMiniRestSeconds,
          }
        : {}),
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
  myoReps?: boolean;
  myoMiniSets?: number;
  myoMiniReps?: number;
  myoMiniRestSeconds?: number;
};

export type NextWorkoutPlan = {
  name: string;
  /** true — хотя бы одно упражнение спрогрессировано из реальных подходов
   *  (этой сессии или последней в истории); false — только дефолтные цели. */
  progressed: boolean;
  items: NextWorkoutPreviewItem[];
};

/** Прогрессия ОДНОГО упражнения с fallback на историю. Порядок источников:
 *  1) рабочие подходы ЭТОЙ сессии → прогрессия (тренер поднял вес/повторы);
 *  2) если в этой сессии подходов не было (частая «пустая» тренировка — упражнения
 *     добавлены, подходы не записаны) → последняя РЕАЛЬНАЯ сессия этого упражнения
 *     из истории → прогрессия от неё;
 *  3) упражнение никогда не выполнялось → стартовые цели 3×8–12 без веса.
 *  Так «следующая тренировка» меняется/прогрессирует ВСЕГДА, даже по пустой
 *  сессии. fromReal=false только для случая 3 (голый дефолт). */
async function nextItemForExercise(
  userId: string,
  exerciseId: string,
  thisSession: {
    sets: { weightKg: number | null; reps: number; setType: string }[];
    myoReps: boolean;
    myoMiniSets: number;
    myoMiniReps: number;
    myoMiniRestSeconds: number;
  },
): Promise<{ item: NextTemplateItem; fromReal: boolean }> {
  const source = { exerciseId, ...thisSession };
  const here = buildNextTemplateItems([source])[0];
  if (here) return { item: here, fromReal: true };

  // Пустая/частичная сессия — тянем последнее реальное выполнение из истории.
  const history = await exerciseSetHistory(userId, exerciseId, 8);
  for (const session of history) {
    const it = buildNextTemplateItems([
      { ...source, sets: session.sets },
    ])[0];
    if (it) return { item: it, fromReal: true };
  }

  return {
    item: {
      exerciseId,
      targetSets: 3,
      targetRepsMin: 8,
      targetRepsMax: 12,
      targetWeightKg: null,
      targetRestSeconds: DEFAULT_REST_SECONDS,
    },
    fromReal: false,
  };
}

/** Строит «следующую тренировку» по завершённой: прогрессия каждого упражнения
 *  (см. nextItemForExercise — с fallback на историю и дефолты). Возвращает пункты
 *  для показа + флаг, была ли хоть где-то реальная прогрессия. null — тренировка
 *  не найдена/не завершена/без упражнений. R-7: getActiveWorkoutForUser гейтит. */
export async function buildNextWorkoutPlan(
  userId: string,
  workoutId: string,
): Promise<NextWorkoutPlan | null> {
  const w = await getActiveWorkoutForUser(userId, workoutId);
  if (!w || w.status !== "completed" || w.exercises.length === 0) return null;

  const items: NextWorkoutPreviewItem[] = [];
  let progressed = false;
  for (const ex of w.exercises) {
    const { item, fromReal } = await nextItemForExercise(
      userId,
      ex.exerciseId,
      {
        sets: ex.sets,
        myoReps: ex.myoReps,
        myoMiniSets: ex.myoMiniSets,
        myoMiniReps: ex.myoMiniReps,
        myoMiniRestSeconds: ex.myoMiniRestSeconds,
      },
    );
    if (fromReal) progressed = true;
    items.push({
      exerciseId: item.exerciseId,
      nameRu: ex.exerciseNameRu,
      targetSets: item.targetSets,
      targetRepsMin: item.targetRepsMin,
      targetRepsMax: item.targetRepsMax,
      targetWeightKg: item.targetWeightKg,
      myoReps: item.myoReps,
      myoMiniSets: item.myoMiniSets,
      myoMiniReps: item.myoMiniReps,
      myoMiniRestSeconds: item.myoMiniRestSeconds,
    });
  }
  return { name: w.name, progressed, items };
}

/** Get-or-create шаблон «следующая тренировка от тренера» по завершённой:
 *  прогрессия каждого упражнения (buildNextWorkoutPlan — с fallback на историю).
 *  Идемпотентно по sourceWorkoutId (source='trainer') — повторные заходы
 *  переиспользуют один шаблон, а не плодят копии. Отсюда стартует
 *  «скорректированная тренировка» прямо из истории — работает и для ad-hoc, и для
 *  пустых сессий (тянет прогрессию из истории). null — тренировка без упражнений.
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

  const plan = await buildNextWorkoutPlan(userId, workoutId);
  if (!plan || plan.items.length === 0) return null;

  const items: NextTemplateItem[] = plan.items.map((it) => ({
    exerciseId: it.exerciseId,
    targetSets: it.targetSets,
    targetRepsMin: it.targetRepsMin,
    targetRepsMax: it.targetRepsMax,
    targetWeightKg: it.targetWeightKg,
    targetRestSeconds: DEFAULT_REST_SECONDS,
    myoReps: it.myoReps,
    myoMiniSets: it.myoMiniSets,
    myoMiniReps: it.myoMiniReps,
    myoMiniRestSeconds: it.myoMiniRestSeconds,
  }));

  return db.transaction(async (tx) => {
    const id = crypto.randomUUID();
    await tx.insert(schema.workoutTemplates).values({
      id,
      userId,
      name: plan.name.slice(0, 80),
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
