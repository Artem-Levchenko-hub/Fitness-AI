import { db } from "@/db/client";
import * as schema from "@/db/schema";
import type { CircuitTemplatePreset } from "@/lib/domain";

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
