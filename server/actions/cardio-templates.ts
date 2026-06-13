"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { buildCardioTemplatePreset } from "@/lib/domain";
import {
  createCardioTemplate,
  startCardioFromTemplate,
  updateCardioTemplate,
} from "@/lib/repos/cardio-templates.repo";

/** Зеркало startSchema из server/actions/cardio.ts — те же поля формы, тот же
 *  диапазон. Сохранение шаблона переиспользует FormData кардио-билдера (preset +
 *  name + параметры), НЕ стартует сессию. */
const saveSchema = z.object({
  preset: z.enum(["tabata", "norwegian_4x4", "emom", "custom"]),
  name: z.string().min(1).max(80),
  rounds: z.coerce.number().int().min(1).max(60).optional(),
  workSec: z.coerce.number().int().min(5).max(60 * 60).optional(),
  restSec: z.coerce.number().int().min(0).max(60 * 60).optional(),
  emomRounds: z.coerce.number().int().min(1).max(60).optional(),
});

/** Разбирает payload кардио-шаблона из FormData в нормализованный пресет (общий
 *  для «сохранить» и «обновить» — один формат, ноль дубля валидации). */
function parseCardioTemplatePayload(formData: FormData) {
  const parsed = saveSchema.safeParse({
    preset: formData.get("preset"),
    name: formData.get("name"),
    rounds: formData.get("rounds") || undefined,
    workSec: formData.get("workSec") || undefined,
    restSec: formData.get("restSec") || undefined,
    emomRounds: formData.get("emomRounds") || undefined,
  });

  if (!parsed.success) {
    throw new Error(
      `Параметры кардио-шаблона неверны: ${parsed.error.issues[0]?.message}`,
    );
  }

  return buildCardioTemplatePreset(parsed.data);
}

/** H14.3 — «Сохранить как шаблон» из кардио-билдера: кардио сохраняется как
 *  именованный переиспользуемый пресет (НЕ стартует сессию). Поля формы — те же,
 *  что у startCardioAction, поэтому кнопка просто переключает formAction. */
export async function saveCardioTemplateAction(formData: FormData) {
  const user = await requireUser();
  const preset = parseCardioTemplatePayload(formData);
  await createCardioTemplate(user.id, preset);

  revalidatePath("/templates");
  revalidatePath("/dashboard");
  redirect("/templates");
}

/** H14.5c — обновление кардио-шаблона из формы редактирования (edit-режим). Тот
 *  же payload-формат, что у save; templateId связан в edit-странице через .bind
 *  (прецедент силового updateTemplateAction.bind). Репозиторий проверяет владение
 *  (R-7) и обновляет одну строку (детей нет). */
export async function updateCardioTemplateAction(
  templateId: string,
  formData: FormData,
) {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(templateId);
  if (!id.success) throw new Error("Неверный id кардио-шаблона");

  const preset = parseCardioTemplatePayload(formData);
  await updateCardioTemplate(user.id, id.data, preset);

  revalidatePath("/templates");
  revalidatePath("/dashboard");
  redirect("/templates");
}

const startSchema = z.object({ templateId: z.string().uuid() });

/** H14.4 — старт кардио из шаблона (одним кликом с /templates). Засевает
 *  существующий startCardioFromPreset пресетом шаблона (ноль дубля логики
 *  старта), ведёт сразу на активный сеанс. */
export async function startCardioFromTemplateAction(formData: FormData) {
  const user = await requireUser();
  const parsed = startSchema.safeParse({
    templateId: formData.get("templateId"),
  });
  if (!parsed.success) throw new Error("Неверный id кардио-шаблона");

  const { id } = await startCardioFromTemplate(user.id, parsed.data.templateId);

  revalidatePath("/cardio");
  revalidatePath("/dashboard");
  redirect(`/cardio/${id}`);
}
