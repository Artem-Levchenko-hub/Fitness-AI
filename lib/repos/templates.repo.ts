import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
} from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import type { RefineCurrentItem } from "@/lib/domain/templates/template-refine";

export type TemplateSource = "manual" | "trainer";

export type TemplateListItem = {
  id: string;
  name: string;
  description: string | null;
  exerciseCount: number;
  updatedAt: Date;
  /** Авторство шаблона — для бейджа «Тренер» (H-T1). */
  source: TemplateSource;
  /** Тренер уже адаптировал шаблон-день под факт (бейдж «обновлён тренером»). */
  adapted: boolean;
};

export type TemplateItemInput = {
  exerciseId: string;
  position: number;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  targetWeightKg: number | null;
  targetRestSeconds: number;
  /** Миорепс-протокол (опционально — отсутствие = выключено с дефолтами). */
  myoReps?: boolean;
  myoMiniSets?: number;
  myoMiniReps?: number;
  myoMiniRestSeconds?: number;
  notes?: string | null;
};

export type TemplateItem = TemplateItemInput & {
  id: string;
  exerciseNameRu: string;
  exerciseNameEn: string;
  /** Из БД мио-поля приходят всегда (колонки NOT NULL) — сужаем опциональность
   *  входного типа до конкретных значений. */
  myoReps: boolean;
  myoMiniSets: number;
  myoMiniReps: number;
  myoMiniRestSeconds: number;
};

export type TemplateWithItems = {
  id: string;
  name: string;
  description: string | null;
  items: TemplateItem[];
  createdAt: Date;
  updatedAt: Date;
  /** Тренер адаптировал шаблон на месте (non-null = есть корректировка). */
  lastAdaptedWorkoutId: string | null;
  /** Когда тренер в последний раз правил шаблон — для подписи «Улучшено тренером». */
  adaptedAt: Date | null;
  /** Есть снимок оригинала → откат возможен. */
  canRevert: boolean;
};

export async function listTemplates(
  userId: string,
): Promise<TemplateListItem[]> {
  const rows = await db
    .select({
      id: schema.workoutTemplates.id,
      name: schema.workoutTemplates.name,
      description: schema.workoutTemplates.description,
      updatedAt: schema.workoutTemplates.updatedAt,
      source: schema.workoutTemplates.source,
      lastAdaptedWorkoutId: schema.workoutTemplates.lastAdaptedWorkoutId,
      exerciseCount: count(schema.templateExercises.id),
    })
    .from(schema.workoutTemplates)
    .leftJoin(
      schema.templateExercises,
      eq(schema.templateExercises.templateId, schema.workoutTemplates.id),
    )
    // «Шаблоны» = только то, по чему реально тренируешься: одиночные шаблоны
    // (programId = null) — всегда; дни систем — лишь ПОСЛЕ первой тренировки
    // (lastAdaptedWorkoutId != null, тренер их уже подправил на месте).
    // Неотренированные пресет-дни активной системы живут в Библиотеке, а не
    // засоряют список «Шаблоны».
    .where(
      and(
        eq(schema.workoutTemplates.userId, userId),
        isNull(schema.workoutTemplates.archivedAt),
        or(
          isNull(schema.workoutTemplates.programId),
          isNotNull(schema.workoutTemplates.lastAdaptedWorkoutId),
        ),
      ),
    )
    .groupBy(schema.workoutTemplates.id)
    .orderBy(desc(schema.workoutTemplates.updatedAt));

  return rows.map(({ lastAdaptedWorkoutId, ...r }) => ({
    ...r,
    adapted: lastAdaptedWorkoutId != null,
  }));
}

export async function getTemplateWithItems(
  userId: string,
  templateId: string,
): Promise<TemplateWithItems | null> {
  const [tpl] = await db
    .select()
    .from(schema.workoutTemplates)
    .where(
      and(
        eq(schema.workoutTemplates.id, templateId),
        eq(schema.workoutTemplates.userId, userId),
      ),
    )
    .limit(1);

  if (!tpl) return null;

  const items = await db
    .select({
      id: schema.templateExercises.id,
      exerciseId: schema.templateExercises.exerciseId,
      position: schema.templateExercises.position,
      targetSets: schema.templateExercises.targetSets,
      targetRepsMin: schema.templateExercises.targetRepsMin,
      targetRepsMax: schema.templateExercises.targetRepsMax,
      targetWeightKg: schema.templateExercises.targetWeightKg,
      targetRestSeconds: schema.templateExercises.targetRestSeconds,
      myoReps: schema.templateExercises.myoReps,
      myoMiniSets: schema.templateExercises.myoMiniSets,
      myoMiniReps: schema.templateExercises.myoMiniReps,
      myoMiniRestSeconds: schema.templateExercises.myoMiniRestSeconds,
      notes: schema.templateExercises.notes,
      exerciseNameRu: schema.exercises.nameRu,
      exerciseNameEn: schema.exercises.nameEn,
    })
    .from(schema.templateExercises)
    .innerJoin(
      schema.exercises,
      eq(schema.exercises.id, schema.templateExercises.exerciseId),
    )
    .where(eq(schema.templateExercises.templateId, templateId))
    .orderBy(asc(schema.templateExercises.position));

  return {
    id: tpl.id,
    name: tpl.name,
    description: tpl.description,
    items,
    createdAt: tpl.createdAt,
    updatedAt: tpl.updatedAt,
    lastAdaptedWorkoutId: tpl.lastAdaptedWorkoutId,
    adaptedAt: tpl.adaptedAt,
    canRevert: tpl.preAdaptSnapshot != null,
  };
}

/** Откат адаптации тренера: восстанавливает оригинальные упражнения шаблона из
 *  снимка (preAdaptSnapshot) и ставит ЛИПКИЙ отказ (adaptOptOut=true) — тренер
 *  больше не переписывает этот шаблон сам, пока атлет не включит заново. Чистит
 *  маркеры адаптации (lastAdaptedWorkoutId/adaptedAt/preAdaptSnapshot). Без
 *  снимка — no-op (нечего восстанавливать). Транзакция, R-7 (гейт по userId). */
export async function revertTemplateAdaptation(
  userId: string,
  templateId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [tpl] = await tx
      .select({ preAdaptSnapshot: schema.workoutTemplates.preAdaptSnapshot })
      .from(schema.workoutTemplates)
      .where(
        and(
          eq(schema.workoutTemplates.id, templateId),
          eq(schema.workoutTemplates.userId, userId),
        ),
      )
      .limit(1);
    if (!tpl) throw new Error("Template not found or not yours");

    const snapshot = tpl.preAdaptSnapshot;
    // Нечего восстанавливать (не адаптирован / уже откатан) — выходим без правок.
    if (snapshot == null) return;

    await tx
      .delete(schema.templateExercises)
      .where(eq(schema.templateExercises.templateId, templateId));

    if (snapshot.length > 0) {
      await tx.insert(schema.templateExercises).values(
        snapshot.map((it, i) => ({
          templateId,
          exerciseId: it.exerciseId,
          position: i,
          targetSets: it.targetSets,
          targetRepsMin: it.targetRepsMin,
          targetRepsMax: it.targetRepsMax,
          targetWeightKg: it.targetWeightKg,
          targetRestSeconds: it.targetRestSeconds,
          // Старые снимки (до 0029) без myo-полей → дефолты (выключено).
          myoReps: it.myoReps ?? false,
          myoMiniSets: it.myoMiniSets ?? 4,
          myoMiniReps: it.myoMiniReps ?? 4,
          myoMiniRestSeconds: it.myoMiniRestSeconds ?? 15,
          notes: it.notes,
        })),
      );
    }

    await tx
      .update(schema.workoutTemplates)
      .set({
        adaptOptOut: true,
        lastAdaptedWorkoutId: null,
        adaptedAt: null,
        preAdaptSnapshot: null,
      })
      .where(eq(schema.workoutTemplates.id, templateId));
  });
}

/** Шаблон, который тренер адаптировал ИМЕННО по этой тренировке — для CTA на
 *  экране разбора («Шаблон обновлён тренером → открыть»). Ключ —
 *  lastAdaptedWorkoutId === workoutId. null, если тренировка не адаптировала
 *  шаблон (ad-hoc, opt-out, ещё не финиширована). R-7: гейт по userId. */
export async function getAdaptedTemplateForWorkout(
  userId: string,
  workoutId: string,
): Promise<{ id: string; name: string } | null> {
  const [row] = await db
    .select({
      id: schema.workoutTemplates.id,
      name: schema.workoutTemplates.name,
    })
    .from(schema.workoutTemplates)
    .where(
      and(
        eq(schema.workoutTemplates.userId, userId),
        eq(schema.workoutTemplates.lastAdaptedWorkoutId, workoutId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export type CreateTemplateInput = {
  name: string;
  description?: string | null;
  items: Omit<TemplateItemInput, "position">[];
};

export async function createTemplate(
  userId: string,
  input: CreateTemplateInput,
): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const id = crypto.randomUUID();
    await tx.insert(schema.workoutTemplates).values({
      id,
      userId,
      name: input.name,
      description: input.description ?? null,
    });

    if (input.items.length > 0) {
      await tx.insert(schema.templateExercises).values(
        input.items.map((it, i) => ({
          templateId: id,
          exerciseId: it.exerciseId,
          position: i,
          targetSets: it.targetSets,
          targetRepsMin: it.targetRepsMin,
          targetRepsMax: it.targetRepsMax,
          targetWeightKg: it.targetWeightKg,
          targetRestSeconds: it.targetRestSeconds,
          myoReps: it.myoReps ?? false,
          myoMiniSets: it.myoMiniSets ?? 4,
          myoMiniReps: it.myoMiniReps ?? 4,
          myoMiniRestSeconds: it.myoMiniRestSeconds ?? 15,
          notes: it.notes ?? null,
        })),
      );
    }

    return { id };
  });
}

export type UpdateTemplateInput = CreateTemplateInput;

export async function updateTemplate(
  userId: string,
  templateId: string,
  input: UpdateTemplateInput,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: schema.workoutTemplates.id })
      .from(schema.workoutTemplates)
      .where(
        and(
          eq(schema.workoutTemplates.id, templateId),
          eq(schema.workoutTemplates.userId, userId),
        ),
      )
      .limit(1);

    if (!existing) throw new Error("Template not found or not yours");

    await tx
      .update(schema.workoutTemplates)
      .set({
        name: input.name,
        description: input.description ?? null,
      })
      .where(eq(schema.workoutTemplates.id, templateId));

    await tx
      .delete(schema.templateExercises)
      .where(eq(schema.templateExercises.templateId, templateId));

    if (input.items.length > 0) {
      await tx.insert(schema.templateExercises).values(
        input.items.map((it, i) => ({
          templateId,
          exerciseId: it.exerciseId,
          position: i,
          targetSets: it.targetSets,
          targetRepsMin: it.targetRepsMin,
          targetRepsMax: it.targetRepsMax,
          targetWeightKg: it.targetWeightKg,
          targetRestSeconds: it.targetRestSeconds,
          myoReps: it.myoReps ?? false,
          myoMiniSets: it.myoMiniSets ?? 4,
          myoMiniReps: it.myoMiniReps ?? 4,
          myoMiniRestSeconds: it.myoMiniRestSeconds ?? 15,
          notes: it.notes ?? null,
        })),
      );
    }
  });
}

export async function deleteTemplate(
  userId: string,
  templateId: string,
): Promise<void> {
  await db
    .delete(schema.workoutTemplates)
    .where(
      and(
        eq(schema.workoutTemplates.id, templateId),
        eq(schema.workoutTemplates.userId, userId),
      ),
    );
}

export type TemplateRefineSource = {
  name: string;
  current: RefineCurrentItem[];
};

/** Собирает текущий шаблон для «улучшить с тренером»: имя + упражнения (slug,
 *  имя, первичные группы, целевые параметры, заметка). slug нужен, чтобы LLM
 *  ссылался на упражнения, а apply резолвил их обратно. R-7: гейт по userId.
 *  null — шаблон не найден / не принадлежит атлету. */
export async function getTemplateForRefine(
  userId: string,
  templateId: string,
): Promise<TemplateRefineSource | null> {
  const [tpl] = await db
    .select({ name: schema.workoutTemplates.name })
    .from(schema.workoutTemplates)
    .where(
      and(
        eq(schema.workoutTemplates.id, templateId),
        eq(schema.workoutTemplates.userId, userId),
      ),
    )
    .limit(1);
  if (!tpl) return null;

  const rows = await db
    .select({
      exerciseId: schema.templateExercises.exerciseId,
      slug: schema.exercises.slug,
      nameRu: schema.exercises.nameRu,
      targetSets: schema.templateExercises.targetSets,
      targetRepsMin: schema.templateExercises.targetRepsMin,
      targetRepsMax: schema.templateExercises.targetRepsMax,
      targetRestSeconds: schema.templateExercises.targetRestSeconds,
      notes: schema.templateExercises.notes,
    })
    .from(schema.templateExercises)
    .innerJoin(
      schema.exercises,
      eq(schema.exercises.id, schema.templateExercises.exerciseId),
    )
    .where(eq(schema.templateExercises.templateId, templateId))
    .orderBy(asc(schema.templateExercises.position));

  const exerciseIds = [...new Set(rows.map((r) => r.exerciseId))];
  const muscleRows = exerciseIds.length
    ? await db
        .select({
          exerciseId: schema.exerciseMuscleGroups.exerciseId,
          muscle: schema.exerciseMuscleGroups.muscleGroupKey,
        })
        .from(schema.exerciseMuscleGroups)
        .where(
          and(
            inArray(schema.exerciseMuscleGroups.exerciseId, exerciseIds),
            eq(schema.exerciseMuscleGroups.role, "primary"),
          ),
        )
    : [];

  const primaryByExercise = new Map<string, string[]>();
  for (const m of muscleRows) {
    const list = primaryByExercise.get(m.exerciseId) ?? [];
    list.push(m.muscle);
    primaryByExercise.set(m.exerciseId, list);
  }

  return {
    name: tpl.name,
    current: rows.map((r) => ({
      slug: r.slug,
      nameRu: r.nameRu,
      primaryMuscles: primaryByExercise.get(r.exerciseId) ?? [],
      targetSets: r.targetSets,
      targetRepsMin: r.targetRepsMin,
      targetRepsMax: r.targetRepsMax,
      targetRestSeconds: r.targetRestSeconds,
      note: r.notes,
    })),
  };
}

/** Резолвит slug → exerciseId среди видимых атлету упражнений (системные ∪ свои).
 *  Для применения улучшения тренера: возвращённые тренером slug превращаем в id.
 *  При коллизии slug системное упражнение имеет приоритет (детерминизм). R-7:
 *  свои упражнения — строго этого userId. */
export async function resolveExerciseIdsBySlug(
  userId: string,
  slugs: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(slugs)];
  if (unique.length === 0) return new Map();

  const rows = await db
    .select({
      id: schema.exercises.id,
      slug: schema.exercises.slug,
      ownerUserId: schema.exercises.ownerUserId,
    })
    .from(schema.exercises)
    .where(
      and(
        inArray(schema.exercises.slug, unique),
        or(
          isNull(schema.exercises.ownerUserId),
          eq(schema.exercises.ownerUserId, userId),
        ),
      ),
    );

  const map = new Map<string, string>();
  for (const r of rows) {
    // Системное (ownerUserId=null) перекрывает своё при коллизии slug.
    const existing = map.get(r.slug);
    if (!existing || r.ownerUserId === null) map.set(r.slug, r.id);
  }
  return map;
}
