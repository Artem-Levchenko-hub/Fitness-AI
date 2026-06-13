"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { buildCircuitTemplatePreset } from "@/lib/domain";
import {
  createCircuitTemplate,
  startCircuitFromTemplate,
  updateCircuitTemplate,
} from "@/lib/repos/circuit-templates.repo";

const exerciseInputSchema = z.object({
  exerciseId: z.string().uuid(),
  kind: z.enum(["reps", "duration"]),
  targetReps: z
    .union([z.coerce.number().int().min(1).max(500), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v == null ? null : Number(v))),
  targetDurationSec: z
    .union([z.coerce.number().int().min(1).max(60 * 60), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v == null ? null : Number(v))),
  targetWeightKg: z
    .union([z.coerce.number().min(0).max(1000), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v == null ? null : Number(v))),
  notes: z.string().max(300).optional().nullable(),
});

const saveSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional().nullable(),
  totalRounds: z.coerce.number().int().min(1).max(30),
  restBetweenRoundsSec: z.coerce.number().int().min(0).max(60 * 60),
  restBetweenExercisesSec: z.coerce.number().int().min(0).max(60 * 60),
  exercises: z.array(exerciseInputSchema).min(1).max(20),
});

/** Разбирает payload кругового шаблона из FormData в нормализованный пресет
 *  (общий для «сохранить» и «обновить» — один формат, ноль дубля валидации). */
function parseCircuitTemplatePayload(formData: FormData) {
  const raw = formData.get("payload");
  if (typeof raw !== "string") {
    throw new Error("Отсутствует payload кругового шаблона");
  }

  let parsed;
  try {
    parsed = saveSchema.parse(JSON.parse(raw));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Неверный payload";
    throw new Error(`Параметры кругового шаблона неверны: ${msg}`);
  }

  // Доп. валидация kind↔target (зеркало startCircuitAction).
  for (const e of parsed.exercises) {
    if (e.kind === "reps" && (e.targetReps == null || e.targetReps <= 0)) {
      throw new Error("Для упражнения с повторениями укажи targetReps");
    }
    if (
      e.kind === "duration" &&
      (e.targetDurationSec == null || e.targetDurationSec <= 0)
    ) {
      throw new Error("Для упражнения с длительностью укажи targetDurationSec");
    }
  }

  return buildCircuitTemplatePreset(parsed);
}

/** H14.1 — «Сохранить как шаблон» из CircuitBuilder: круговая сохраняется как
 *  именованный переиспользуемый пресет (НЕ стартует сессию). Payload (JSON) —
 *  тот же формат, что у startCircuitAction. */
export async function saveCircuitTemplateAction(formData: FormData) {
  const user = await requireUser();
  const preset = parseCircuitTemplatePayload(formData);
  await createCircuitTemplate(user.id, preset);

  revalidatePath("/templates");
  revalidatePath("/dashboard");
  redirect("/templates");
}

/** H14.5b — обновление кругового шаблона из CircuitBuilder (edit-режим). Тот же
 *  payload-формат, что у save; templateId связан в edit-странице/билдере.
 *  Репозиторий проверяет владение (R-7) и транзакционно заменяет упражнения. */
export async function updateCircuitTemplateAction(
  templateId: string,
  formData: FormData,
) {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(templateId);
  if (!id.success) throw new Error("Неверный id кругового шаблона");

  const preset = parseCircuitTemplatePayload(formData);
  await updateCircuitTemplate(user.id, id.data, preset);

  revalidatePath("/templates");
  revalidatePath("/dashboard");
  redirect("/templates");
}

const startSchema = z.object({ templateId: z.string().uuid() });

/** H14.2 — старт круговой из шаблона (одним кликом с /templates). Засевает
 *  существующий startCircuit пресетом шаблона (ноль дубля логики старта),
 *  ведёт сразу на активный сеанс. */
export async function startCircuitFromTemplateAction(formData: FormData) {
  const user = await requireUser();
  const parsed = startSchema.safeParse({
    templateId: formData.get("templateId"),
  });
  if (!parsed.success) throw new Error("Неверный id кругового шаблона");

  const { id } = await startCircuitFromTemplate(user.id, parsed.data.templateId);

  revalidatePath("/circuits");
  revalidatePath("/dashboard");
  redirect(`/circuits/${id}`);
}
