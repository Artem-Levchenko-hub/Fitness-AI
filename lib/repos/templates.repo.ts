import { and, asc, count, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import type { NextTemplateItem } from "@/lib/domain/templates/next-template";

export type TemplateSource = "manual" | "trainer";

export type TemplateListItem = {
  id: string;
  name: string;
  description: string | null;
  exerciseCount: number;
  updatedAt: Date;
  /** Авторство шаблона — для бейджа «Тренер» (H-T1). */
  source: TemplateSource;
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
      exerciseCount: count(schema.templateExercises.id),
    })
    .from(schema.workoutTemplates)
    .leftJoin(
      schema.templateExercises,
      eq(schema.templateExercises.templateId, schema.workoutTemplates.id),
    )
    .where(
      and(
        eq(schema.workoutTemplates.userId, userId),
        isNull(schema.workoutTemplates.archivedAt),
      ),
    )
    .groupBy(schema.workoutTemplates.id)
    .orderBy(desc(schema.workoutTemplates.updatedAt));

  return rows;
}

/** Уже есть trainer-шаблон «следующая», составленный по этой тренировке?
 *  Ключ идемпотентности — повторный finish / реплей офлайн-дренажа не плодит
 *  дубликаты (R-31 семантика). */
export async function trainerTemplateExistsForWorkout(
  userId: string,
  workoutId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.workoutTemplates.id })
    .from(schema.workoutTemplates)
    .where(
      and(
        eq(schema.workoutTemplates.userId, userId),
        eq(schema.workoutTemplates.sourceWorkoutId, workoutId),
        eq(schema.workoutTemplates.source, "trainer"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** Создаёт trainer-шаблон «следующая тренировка» (прогрессия по завершённой
 *  силовой). items уже посчитаны чистым доменом `buildNextTemplateItems`. */
export async function createTrainerNextTemplate(
  userId: string,
  input: { name: string; sourceWorkoutId: string; items: NextTemplateItem[] },
): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const id = crypto.randomUUID();
    await tx.insert(schema.workoutTemplates).values({
      id,
      userId,
      name: input.name,
      source: "trainer",
      sourceWorkoutId: input.sourceWorkoutId,
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
        })),
      );
    }

    return { id };
  });
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
  };
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
