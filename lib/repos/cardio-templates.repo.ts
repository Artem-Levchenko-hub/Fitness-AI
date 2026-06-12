import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  summarizeCardioTemplate,
  type CardioTemplateParams,
  type CardioTemplatePreset,
} from "@/lib/domain";
import { startCardioFromPreset } from "@/lib/repos/cardio.repo";

export type CardioTemplateListItem = {
  id: string;
  name: string;
  description: string | null;
  metaLine: string;
  updatedAt: Date;
};

/** H14.4 — список кардио-шаблонов пользователя для /templates (R-7: userId
 *  явный, не-архивные, свежие сверху). У кардио нет упражнений-детей → вместо
 *  счёта упражнений мета-строка сводки интервалов (summarizeCardioTemplate).
 *  Питает единую поверхность через mergeTemplateList. */
export async function listCardioTemplates(
  userId: string,
): Promise<CardioTemplateListItem[]> {
  const rows = await db
    .select({
      id: schema.cardioTemplates.id,
      name: schema.cardioTemplates.name,
      description: schema.cardioTemplates.description,
      preset: schema.cardioTemplates.preset,
      planJson: schema.cardioTemplates.planJson,
      updatedAt: schema.cardioTemplates.updatedAt,
    })
    .from(schema.cardioTemplates)
    .where(
      and(
        eq(schema.cardioTemplates.userId, userId),
        isNull(schema.cardioTemplates.archivedAt),
      ),
    )
    .orderBy(desc(schema.cardioTemplates.updatedAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    updatedAt: r.updatedAt,
    metaLine: summarizeCardioTemplate(
      r.preset,
      r.planJson as CardioTemplateParams | null,
    ),
  }));
}

/** H14.4 — старт кардио из шаблона: читает пресет (R-7: фильтр по userId,
 *  чужой/несуществующий → ошибка), делегирует в startCardioFromPreset (ноль
 *  дубля логики старта — тот же G2-инвариант отменяет прошлую active-кардио;
 *  блоки выводятся из preset+params детерминированно). Зеркало
 *  startCircuitFromTemplate, но источник — cardio_templates. */
export async function startCardioFromTemplate(
  userId: string,
  templateId: string,
): Promise<{ id: string }> {
  const [tpl] = await db
    .select()
    .from(schema.cardioTemplates)
    .where(
      and(
        eq(schema.cardioTemplates.id, templateId),
        eq(schema.cardioTemplates.userId, userId),
      ),
    )
    .limit(1);
  if (!tpl) throw new Error("Кардио-шаблон не найден или не твой");

  return startCardioFromPreset(userId, {
    preset: tpl.preset,
    name: tpl.name,
    params: (tpl.planJson as CardioTemplateParams | null) ?? undefined,
  });
}

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
