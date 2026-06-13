import { and, asc, count, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import type {
  CircuitTemplatePreset,
  CircuitTemplateRowForEdit,
} from "@/lib/domain";
import { startCircuit } from "@/lib/repos/circuits.repo";

export type CircuitTemplateListItem = {
  id: string;
  name: string;
  description: string | null;
  exerciseCount: number;
  updatedAt: Date;
};

/** H14.2 — список круговых шаблонов пользователя для /templates (R-7: userId
 *  явный). Зеркалит listTemplates силовых: счёт упражнений, не-архивные,
 *  свежие сверху. Питает единую поверхность через mergeTemplateList. */
export async function listCircuitTemplates(
  userId: string,
): Promise<CircuitTemplateListItem[]> {
  const rows = await db
    .select({
      id: schema.circuitTemplates.id,
      name: schema.circuitTemplates.name,
      description: schema.circuitTemplates.description,
      updatedAt: schema.circuitTemplates.updatedAt,
      exerciseCount: count(schema.circuitTemplateExercises.id),
    })
    .from(schema.circuitTemplates)
    .leftJoin(
      schema.circuitTemplateExercises,
      eq(
        schema.circuitTemplateExercises.circuitTemplateId,
        schema.circuitTemplates.id,
      ),
    )
    .where(
      and(
        eq(schema.circuitTemplates.userId, userId),
        isNull(schema.circuitTemplates.archivedAt),
      ),
    )
    .groupBy(schema.circuitTemplates.id)
    .orderBy(desc(schema.circuitTemplates.updatedAt));

  return rows;
}

/** H14.2 — старт круговой из шаблона: читает пресет (R-7: фильтр по userId,
 *  чужой/несуществующий → ошибка), делегирует в startCircuit (ноль дубля
 *  логики старта — тот же G2-инвариант: отменяет прошлую active-круговую).
 *  Зеркало cloneCircuit, но источник — circuit_templates, а не прошлый сеанс. */
export async function startCircuitFromTemplate(
  userId: string,
  templateId: string,
): Promise<{ id: string }> {
  const [tpl] = await db
    .select()
    .from(schema.circuitTemplates)
    .where(
      and(
        eq(schema.circuitTemplates.id, templateId),
        eq(schema.circuitTemplates.userId, userId),
      ),
    )
    .limit(1);
  if (!tpl) throw new Error("Круговой шаблон не найден или не твой");

  const exercises = await db
    .select()
    .from(schema.circuitTemplateExercises)
    .where(eq(schema.circuitTemplateExercises.circuitTemplateId, templateId))
    .orderBy(asc(schema.circuitTemplateExercises.orderIdx));

  return startCircuit(userId, {
    name: tpl.name,
    totalRounds: tpl.totalRounds,
    restBetweenRoundsSec: tpl.restBetweenRoundsSec,
    restBetweenExercisesSec: tpl.restBetweenExercisesSec,
    exercises: exercises.map((e) => ({
      exerciseId: e.exerciseId,
      kind: e.kind,
      targetReps: e.targetReps,
      targetDurationSec: e.targetDurationSec,
      targetWeightKg: e.targetWeightKg,
      notes: e.notes,
    })),
  });
}

/** H14.5b — грузит круговой шаблон + упражнения для редактирования (R-7:
 *  userId явный, чужой/несуществующий → null). Несёт id строк упражнений
 *  (стабильный uid для билдера) и orderIdx (сортировка в toCircuitBuilderInitial). */
export async function getCircuitTemplateForEdit(
  userId: string,
  templateId: string,
): Promise<CircuitTemplateRowForEdit | null> {
  const [tpl] = await db
    .select()
    .from(schema.circuitTemplates)
    .where(
      and(
        eq(schema.circuitTemplates.id, templateId),
        eq(schema.circuitTemplates.userId, userId),
      ),
    )
    .limit(1);
  if (!tpl) return null;

  const exercises = await db
    .select()
    .from(schema.circuitTemplateExercises)
    .where(eq(schema.circuitTemplateExercises.circuitTemplateId, templateId))
    .orderBy(asc(schema.circuitTemplateExercises.orderIdx));

  return {
    id: tpl.id,
    name: tpl.name,
    totalRounds: tpl.totalRounds,
    restBetweenRoundsSec: tpl.restBetweenRoundsSec,
    restBetweenExercisesSec: tpl.restBetweenExercisesSec,
    exercises: exercises.map((e) => ({
      id: e.id,
      exerciseId: e.exerciseId,
      orderIdx: e.orderIdx,
      kind: e.kind,
      targetReps: e.targetReps,
      targetDurationSec: e.targetDurationSec,
      targetWeightKg: e.targetWeightKg,
      notes: e.notes,
    })),
  };
}

/** H14.5b — обновляет круговой шаблон одной транзакцией: проверяет владение
 *  (R-7: userId-фильтр, чужой/несуществующий → ошибка), обновляет параметры
 *  круга, ПОЛНОСТЬЮ заменяет упражнения (delete-then-insert — порядок/состав
 *  могли поменяться целиком). updatedAt поднимается через $onUpdate. */
export async function updateCircuitTemplate(
  userId: string,
  templateId: string,
  preset: CircuitTemplatePreset,
): Promise<void> {
  if (preset.exercises.length === 0) {
    throw new Error("В круговом шаблоне должно быть хотя бы одно упражнение");
  }

  await db.transaction(async (tx) => {
    const [owned] = await tx
      .select({ id: schema.circuitTemplates.id })
      .from(schema.circuitTemplates)
      .where(
        and(
          eq(schema.circuitTemplates.id, templateId),
          eq(schema.circuitTemplates.userId, userId),
        ),
      )
      .limit(1);
    if (!owned) throw new Error("Круговой шаблон не найден или не твой");

    await tx
      .update(schema.circuitTemplates)
      .set({
        name: preset.name,
        description: preset.description,
        totalRounds: preset.totalRounds,
        restBetweenRoundsSec: preset.restBetweenRoundsSec,
        restBetweenExercisesSec: preset.restBetweenExercisesSec,
        updatedAt: new Date(),
      })
      .where(eq(schema.circuitTemplates.id, templateId));

    await tx
      .delete(schema.circuitTemplateExercises)
      .where(eq(schema.circuitTemplateExercises.circuitTemplateId, templateId));

    await tx.insert(schema.circuitTemplateExercises).values(
      preset.exercises.map((e) => ({
        circuitTemplateId: templateId,
        exerciseId: e.exerciseId,
        orderIdx: e.orderIdx,
        kind: e.kind,
        targetReps: e.targetReps,
        targetDurationSec: e.targetDurationSec,
        targetWeightKg: e.targetWeightKg,
        notes: e.notes,
      })),
    );
  });
}

/** H14.1 — создаёт круговой шаблон + его упражнения одной транзакцией.
 *  R-7: userId явный, шаблон принадлежит вызывающему. Пресет уже нормализован
 *  чистой buildCircuitTemplatePreset (orderIdx/kind-поля выставлены). */
export async function createCircuitTemplate(
  userId: string,
  preset: CircuitTemplatePreset,
): Promise<{ id: string }> {
  if (preset.exercises.length === 0) {
    throw new Error("В круговом шаблоне должно быть хотя бы одно упражнение");
  }

  return db.transaction(async (tx) => {
    const id = crypto.randomUUID();
    await tx.insert(schema.circuitTemplates).values({
      id,
      userId,
      name: preset.name,
      description: preset.description,
      totalRounds: preset.totalRounds,
      restBetweenRoundsSec: preset.restBetweenRoundsSec,
      restBetweenExercisesSec: preset.restBetweenExercisesSec,
    });

    await tx.insert(schema.circuitTemplateExercises).values(
      preset.exercises.map((e) => ({
        circuitTemplateId: id,
        exerciseId: e.exerciseId,
        orderIdx: e.orderIdx,
        kind: e.kind,
        targetReps: e.targetReps,
        targetDurationSec: e.targetDurationSec,
        targetWeightKg: e.targetWeightKg,
        notes: e.notes,
      })),
    );

    return { id };
  });
}
