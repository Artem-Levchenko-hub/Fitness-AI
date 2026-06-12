"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { buildCircuitTemplatePreset } from "@/lib/domain";
import { createCircuitTemplate } from "@/lib/repos/circuit-templates.repo";

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

/** H14.1 — «Сохранить как шаблон» из CircuitBuilder: круговая сохраняется как
 *  именованный переиспользуемый пресет (НЕ стартует сессию). Payload (JSON) —
 *  тот же формат, что у startCircuitAction. */
export async function saveCircuitTemplateAction(formData: FormData) {
  const user = await requireUser();
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

  const preset = buildCircuitTemplatePreset(parsed);
  await createCircuitTemplate(user.id, preset);

  revalidatePath("/templates");
  revalidatePath("/dashboard");
  redirect("/templates");
}
