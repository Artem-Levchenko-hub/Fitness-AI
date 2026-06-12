import { db } from "@/db/client";
import * as schema from "@/db/schema";
import type { CardioTemplatePreset } from "@/lib/domain";

/** H14.3 — создаёт кардио-шаблон одной строкой (R-7: userId явный, шаблон
 *  принадлежит вызывающему). Пресет уже нормализован чистой
 *  buildCardioTemplatePreset (params содержит только релевантные пресету поля).
 *  В отличие от createCircuitTemplate здесь нет упражнений-детей и транзакции —
 *  блоки кардио выводятся из preset+params при старте (H14.4). */
export async function createCardioTemplate(
  userId: string,
  preset: CardioTemplatePreset,
): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  await db.insert(schema.cardioTemplates).values({
    id,
    userId,
    name: preset.name,
    preset: preset.preset,
    planJson: preset.params,
  });
  return { id };
}
