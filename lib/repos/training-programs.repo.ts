import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  buildInPlaceAdaptation,
  pickSubstitute,
  type AdaptItem,
  type SubstituteCandidate,
} from "@/lib/domain/programs/adapt";
import { getLibraryProgram } from "@/lib/domain/programs/library";
import type { WorkoutExerciseInput } from "@/lib/domain/templates/next-template";
import {
  detectStagnation,
  E1RM_STAGNATION_EPSILON_KG,
} from "@/lib/domain/progression/stagnation";
import { exerciseSetHistory } from "@/lib/repos/stats.repo";

export type ProgramListItem = {
  id: string;
  name: string;
  /** Откуда программа: slug пресета библиотеки или null (собрана из своих). */
  librarySlug: string | null;
  dayCount: number;
  updatedAt: Date;
};

export type ProgramDay = {
  templateId: string;
  name: string;
  dayOrder: number | null;
  exerciseCount: number;
  /** Тренер уже адаптировал этот день на месте (хотя бы раз). */
  adapted: boolean;
};

export type ProgramWithDays = {
  id: string;
  name: string;
  description: string | null;
  librarySlug: string | null;
  createdAt: Date;
  days: ProgramDay[];
};

/** Системные упражнения (ownerUserId = null) по slug → id. Каталог библиотеки
 *  ссылается на упражнения по slug; копия резолвит их в реальные id. */
async function resolveSystemExerciseIds(
  slugs: string[],
): Promise<Map<string, string>> {
  if (slugs.length === 0) return new Map();
  const rows = await db
    .select({ id: schema.exercises.id, slug: schema.exercises.slug })
    .from(schema.exercises)
    .where(
      and(
        isNull(schema.exercises.ownerUserId),
        inArray(schema.exercises.slug, slugs),
      ),
    );
  return new Map(rows.map((r) => [r.slug, r.id]));
}

/** «Использовать» программу из библиотеки: глубокая копия пресета в строки
 *  пользователя — программа + по шаблону-дню на каждый день + их упражнения.
 *  Библиотека (TS-каталог) неизменна; прогресс и адаптация идут на этой копии. */
export async function copyLibraryProgramToUser(
  userId: string,
  librarySlug: string,
): Promise<{ id: string }> {
  const preset = getLibraryProgram(librarySlug);
  if (!preset) throw new Error(`Unknown library program: ${librarySlug}`);

  const slugs = [
    ...new Set(preset.days.flatMap((d) => d.items.map((i) => i.exerciseSlug))),
  ];
  const idBySlug = await resolveSystemExerciseIds(slugs);
  const missing = slugs.filter((s) => !idBySlug.has(s));
  if (missing.length > 0) {
    throw new Error(`Library exercises not seeded: ${missing.join(", ")}`);
  }

  return db.transaction(async (tx) => {
    const programId = crypto.randomUUID();
    await tx.insert(schema.trainingPrograms).values({
      id: programId,
      userId,
      name: preset.name,
      description: preset.description,
      librarySlug: preset.slug,
    });

    for (const [dayOrder, day] of preset.days.entries()) {
      const templateId = crypto.randomUUID();
      await tx.insert(schema.workoutTemplates).values({
        id: templateId,
        userId,
        name: day.name,
        programId,
        dayOrder,
        source: "manual",
      });
      if (day.items.length > 0) {
        await tx.insert(schema.templateExercises).values(
          day.items.map((it, i) => ({
            templateId,
            exerciseId: idBySlug.get(it.exerciseSlug)!,
            position: i,
            targetSets: it.targetSets,
            targetRepsMin: it.targetRepsMin,
            targetRepsMax: it.targetRepsMax,
            targetWeightKg: it.targetWeightKg,
            targetRestSeconds: it.targetRestSeconds,
          })),
        );
      }
    }

    return { id: programId };
  });
}

/** Обернуть свои шаблоны в тренировочную систему: создаёт программу и привязывает
 *  выбранные шаблоны как дни (в переданном порядке). Все шаблоны должны
 *  принадлежать пользователю (R-7) — иначе ошибка. */
export async function wrapTemplatesIntoProgram(
  userId: string,
  input: { name: string; description?: string | null; templateIds: string[] },
): Promise<{ id: string }> {
  if (input.templateIds.length === 0) {
    throw new Error("Нужен хотя бы один шаблон для системы");
  }
  return db.transaction(async (tx) => {
    const owned = await tx
      .select({ id: schema.workoutTemplates.id })
      .from(schema.workoutTemplates)
      .where(
        and(
          eq(schema.workoutTemplates.userId, userId),
          inArray(schema.workoutTemplates.id, input.templateIds),
        ),
      );
    if (owned.length !== input.templateIds.length) {
      throw new Error("Some templates not found or not yours");
    }

    const programId = crypto.randomUUID();
    await tx.insert(schema.trainingPrograms).values({
      id: programId,
      userId,
      name: input.name,
      description: input.description ?? null,
    });

    // Порядок дней = порядок templateIds (источник истины — выбор пользователя).
    for (const [dayOrder, templateId] of input.templateIds.entries()) {
      await tx
        .update(schema.workoutTemplates)
        .set({ programId, dayOrder })
        .where(
          and(
            eq(schema.workoutTemplates.id, templateId),
            eq(schema.workoutTemplates.userId, userId),
          ),
        );
    }

    return { id: programId };
  });
}

export async function listPrograms(
  userId: string,
): Promise<ProgramListItem[]> {
  return db
    .select({
      id: schema.trainingPrograms.id,
      name: schema.trainingPrograms.name,
      librarySlug: schema.trainingPrograms.librarySlug,
      updatedAt: schema.trainingPrograms.updatedAt,
      dayCount: count(schema.workoutTemplates.id),
    })
    .from(schema.trainingPrograms)
    .leftJoin(
      schema.workoutTemplates,
      eq(schema.workoutTemplates.programId, schema.trainingPrograms.id),
    )
    .where(
      and(
        eq(schema.trainingPrograms.userId, userId),
        isNull(schema.trainingPrograms.archivedAt),
      ),
    )
    .groupBy(schema.trainingPrograms.id)
    .orderBy(desc(schema.trainingPrograms.updatedAt));
}

export async function getProgramWithDays(
  userId: string,
  programId: string,
): Promise<ProgramWithDays | null> {
  const [program] = await db
    .select()
    .from(schema.trainingPrograms)
    .where(
      and(
        eq(schema.trainingPrograms.id, programId),
        eq(schema.trainingPrograms.userId, userId),
      ),
    )
    .limit(1);

  if (!program) return null;

  const rows = await db
    .select({
      templateId: schema.workoutTemplates.id,
      name: schema.workoutTemplates.name,
      dayOrder: schema.workoutTemplates.dayOrder,
      lastAdaptedWorkoutId: schema.workoutTemplates.lastAdaptedWorkoutId,
      exerciseCount: count(schema.templateExercises.id),
    })
    .from(schema.workoutTemplates)
    .leftJoin(
      schema.templateExercises,
      eq(schema.templateExercises.templateId, schema.workoutTemplates.id),
    )
    .where(eq(schema.workoutTemplates.programId, programId))
    .groupBy(schema.workoutTemplates.id)
    .orderBy(asc(schema.workoutTemplates.dayOrder));

  return {
    id: program.id,
    name: program.name,
    description: program.description,
    librarySlug: program.librarySlug,
    createdAt: program.createdAt,
    days: rows.map((r) => ({
      templateId: r.templateId,
      name: r.name,
      dayOrder: r.dayOrder,
      exerciseCount: r.exerciseCount,
      adapted: r.lastAdaptedWorkoutId != null,
    })),
  };
}

/** Удалить программу: дни-шаблоны отвязываются в standalone (не теряются),
 *  затем удаляется строка программы. SET NULL на FK сделал бы это сам, но
 *  чистим и dayOrder, чтобы не оставлять «висячий» порядок. */
export async function deleteProgram(
  userId: string,
  programId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(schema.workoutTemplates)
      .set({ programId: null, dayOrder: null })
      .where(
        and(
          eq(schema.workoutTemplates.programId, programId),
          eq(schema.workoutTemplates.userId, userId),
        ),
      );
    await tx
      .delete(schema.trainingPrograms)
      .where(
        and(
          eq(schema.trainingPrograms.id, programId),
          eq(schema.trainingPrograms.userId, userId),
        ),
      );
  });
}

/** Текущие элементы шаблона-дня в форме доменной адаптации (без имён упражнений
 *  — для расчёта, не для показа). */
async function getTemplateAdaptItems(templateId: string): Promise<AdaptItem[]> {
  const rows = await db
    .select({
      exerciseId: schema.templateExercises.exerciseId,
      position: schema.templateExercises.position,
      targetSets: schema.templateExercises.targetSets,
      targetRepsMin: schema.templateExercises.targetRepsMin,
      targetRepsMax: schema.templateExercises.targetRepsMax,
      targetWeightKg: schema.templateExercises.targetWeightKg,
      targetRestSeconds: schema.templateExercises.targetRestSeconds,
      notes: schema.templateExercises.notes,
    })
    .from(schema.templateExercises)
    .where(eq(schema.templateExercises.templateId, templateId))
    .orderBy(asc(schema.templateExercises.position));
  return rows;
}

/** Записывает адаптированные элементы в ТОТ ЖЕ шаблон-день (replace) и ставит
 *  ключ идемпотентности lastAdaptedWorkoutId. Транзакция, проверка владения. */
export async function adaptProgramTemplateInPlace(
  userId: string,
  templateId: string,
  items: AdaptItem[],
  workoutId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [owned] = await tx
      .select({ id: schema.workoutTemplates.id })
      .from(schema.workoutTemplates)
      .where(
        and(
          eq(schema.workoutTemplates.id, templateId),
          eq(schema.workoutTemplates.userId, userId),
        ),
      )
      .limit(1);
    if (!owned) throw new Error("Template not found or not yours");

    await tx
      .delete(schema.templateExercises)
      .where(eq(schema.templateExercises.templateId, templateId));

    if (items.length > 0) {
      await tx.insert(schema.templateExercises).values(
        items.map((it, i) => ({
          templateId,
          exerciseId: it.exerciseId,
          position: i,
          targetSets: it.targetSets,
          targetRepsMin: it.targetRepsMin,
          targetRepsMax: it.targetRepsMax,
          targetWeightKg: it.targetWeightKg,
          targetRestSeconds: it.targetRestSeconds,
          notes: it.notes ?? null,
        })),
      );
    }

    await tx
      .update(schema.workoutTemplates)
      .set({ lastAdaptedWorkoutId: workoutId })
      .where(eq(schema.workoutTemplates.id, templateId));
  });
}

/** Шаблон-день, по которому стартовала эта тренировка (если стартовала по
 *  программному шаблону). null — тренировка ad-hoc или одиночный шаблон. */
async function getProgramDayBinding(
  userId: string,
  workoutId: string,
): Promise<{
  templateId: string;
  lastAdaptedWorkoutId: string | null;
} | null> {
  const [row] = await db
    .select({
      templateId: schema.workoutTemplates.id,
      lastAdaptedWorkoutId: schema.workoutTemplates.lastAdaptedWorkoutId,
    })
    .from(schema.workouts)
    .innerJoin(
      schema.workoutTemplates,
      eq(schema.workoutTemplates.id, schema.workouts.templateId),
    )
    .where(
      and(
        eq(schema.workouts.id, workoutId),
        eq(schema.workouts.userId, userId),
      ),
    )
    .limit(1);

  if (!row) return null;
  // Программный шаблон? (есть привязка к программе)
  const [tpl] = await db
    .select({ programId: schema.workoutTemplates.programId })
    .from(schema.workoutTemplates)
    .where(eq(schema.workoutTemplates.id, row.templateId))
    .limit(1);
  if (!tpl?.programId) return null;
  return row;
}

/** Подбор замены застойному упражнению среди СИСТЕМНЫХ упражнений той же
 *  первичной группы (R-04: решение чистым `pickSubstitute`, данные — из БД).
 *  Исключаем то, что уже есть в шаблоне, и сам застойный id. null — нет замены. */
async function findSubstitute(
  stagnantExerciseId: string,
  excludeIds: string[],
): Promise<string | null> {
  const prim = await db
    .select({ m: schema.exerciseMuscleGroups.muscleGroupKey })
    .from(schema.exerciseMuscleGroups)
    .where(
      and(
        eq(schema.exerciseMuscleGroups.exerciseId, stagnantExerciseId),
        eq(schema.exerciseMuscleGroups.role, "primary"),
      ),
    );
  const muscles = prim.map((r) => r.m);
  if (muscles.length === 0) return null;

  const rows = await db
    .select({
      id: schema.exercises.id,
      slug: schema.exercises.slug,
      muscle: schema.exerciseMuscleGroups.muscleGroupKey,
    })
    .from(schema.exercises)
    .innerJoin(
      schema.exerciseMuscleGroups,
      and(
        eq(schema.exerciseMuscleGroups.exerciseId, schema.exercises.id),
        eq(schema.exerciseMuscleGroups.role, "primary"),
      ),
    )
    .where(
      and(
        isNull(schema.exercises.ownerUserId),
        inArray(schema.exerciseMuscleGroups.muscleGroupKey, muscles),
      ),
    )
    .orderBy(asc(schema.exercises.slug));

  // Группируем строки по упражнению → его первичные группы.
  const byId = new Map<string, SubstituteCandidate>();
  for (const r of rows) {
    const c = byId.get(r.id);
    if (c) (c.primaryMuscles as string[]).push(r.muscle);
    else byId.set(r.id, { exerciseId: r.id, primaryMuscles: [r.muscle], isStagnant: false });
  }
  const candidates = [...byId.values()];

  return pickSubstitute(muscles, candidates, [...excludeIds, stagnantExerciseId]);
}

/** Застойно ли упражнение (e1RM не растёт ≥3 сессии) — тот же источник, что
 *  питает бейдж застоя и флаги тренера (R-04: exerciseSetHistory +
 *  detectStagnation + единый epsilon). */
async function isExerciseStagnant(
  userId: string,
  exerciseId: string,
): Promise<boolean> {
  const history = await exerciseSetHistory(userId, exerciseId);
  const series = history
    .filter((s) => s.best1rm > 0)
    .map((s) => s.best1rm)
    .reverse();
  return detectStagnation(series, 3, { epsilon: E1RM_STAGNATION_EPSILON_KG })
    .stale;
}

export type ProgramAdaptationResult = {
  /** true — день программы адаптирован на месте сейчас. */
  adapted: boolean;
  /** Сделанный свап упражнения (id→id) или null. */
  swap: { fromExerciseId: string; toExerciseId: string } | null;
};

/** Оркестратор адаптации дня программы ПОСЛЕ завершённой тренировки. Возвращает
 *  null, если тренировка НЕ по программному шаблону — тогда вызывающий идёт
 *  старым путём (новый trainer-шаблон «следующая»). Идемпотентно по workoutId
 *  (lastAdaptedWorkoutId): повторный finish / офлайн-реплей = no-op. Свап —
 *  не более одного и только при подтверждённом застое (изредка). */
export async function adaptProgramDayAfterWorkout(
  userId: string,
  workoutId: string,
  performed: WorkoutExerciseInput[],
): Promise<ProgramAdaptationResult | null> {
  const binding = await getProgramDayBinding(userId, workoutId);
  if (!binding) return null; // не программный день → старый путь

  // Идемпотентность: этот шаблон уже адаптирован по этой тренировке.
  if (binding.lastAdaptedWorkoutId === workoutId) {
    return { adapted: false, swap: null };
  }

  const current = await getTemplateAdaptItems(binding.templateId);
  const excludeIds = current.map((c) => c.exerciseId);

  // Ищем ПЕРВОЕ застойное упражнение дня, которому есть замена. Не более одного
  // свапа — «изредка», чтобы не выпотрошить шаблон.
  const substitutes: Record<string, string> = {};
  for (const it of current) {
    if (!(await isExerciseStagnant(userId, it.exerciseId))) continue;
    const sub = await findSubstitute(it.exerciseId, excludeIds);
    if (sub) {
      substitutes[it.exerciseId] = sub;
      break;
    }
  }

  const { items, swap } = buildInPlaceAdaptation(current, performed, substitutes);
  await adaptProgramTemplateInPlace(userId, binding.templateId, items, workoutId);

  return { adapted: true, swap };
}
