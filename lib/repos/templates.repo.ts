import { and, asc, count, desc, eq, isNotNull, isNull, or } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";

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
  notes?: string | null;
};

export type TemplateItem = TemplateItemInput & {
  id: string;
  exerciseNameRu: string;
  exerciseNameEn: string;
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
