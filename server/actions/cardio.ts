"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import {
  cancelCardioWorkout,
  finishCardioWorkout,
  logCardioBlock,
  startCardioFromPreset,
} from "@/lib/repos/cardio.repo";

const startSchema = z.object({
  preset: z.enum(["tabata", "norwegian_4x4", "emom", "custom"]),
  name: z.string().min(1).max(80),
  rounds: z.coerce.number().int().min(1).max(60).optional(),
  workSec: z.coerce.number().int().min(5).max(60 * 60).optional(),
  restSec: z.coerce.number().int().min(0).max(60 * 60).optional(),
  emomRounds: z.coerce.number().int().min(1).max(60).optional(),
});

export async function startCardioAction(formData: FormData) {
  const user = await requireUser();
  const parsed = startSchema.safeParse({
    preset: formData.get("preset"),
    name: formData.get("name"),
    rounds: formData.get("rounds") || undefined,
    workSec: formData.get("workSec") || undefined,
    restSec: formData.get("restSec") || undefined,
    emomRounds: formData.get("emomRounds") || undefined,
  });

  if (!parsed.success) {
    throw new Error(
      `Параметры кардио неверны: ${parsed.error.issues[0]?.message}`,
    );
  }

  const { id } = await startCardioFromPreset(user.id, {
    preset: parsed.data.preset,
    name: parsed.data.name,
    params: {
      rounds: parsed.data.rounds,
      workSec: parsed.data.workSec,
      restSec: parsed.data.restSec,
      emomRounds: parsed.data.emomRounds,
    },
  });

  revalidatePath("/cardio");
  revalidatePath("/dashboard");
  redirect(`/cardio/${id}`);
}

const logBlockSchema = z.object({
  cardioId: z.string().uuid(),
  blockId: z.string().uuid(),
  actualDurationSec: z.coerce.number().int().min(0).max(60 * 60),
  hrAvg: z
    .union([z.coerce.number().int().min(30).max(240), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v == null ? null : Number(v))),
  rpe: z
    .union([z.coerce.number().min(1).max(10), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v == null ? null : Number(v))),
  notes: z.string().max(500).optional().nullable(),
});

export type LogBlockState =
  | { status: "idle" }
  | { status: "error"; message: string };

export async function logCardioBlockAction(
  _prev: LogBlockState,
  formData: FormData,
): Promise<LogBlockState> {
  const user = await requireUser();
  const parsed = logBlockSchema.safeParse({
    cardioId: formData.get("cardioId"),
    blockId: formData.get("blockId"),
    actualDurationSec: formData.get("actualDurationSec"),
    hrAvg: formData.get("hrAvg") ?? undefined,
    rpe: formData.get("rpe") ?? undefined,
    notes: formData.get("notes") || null,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Проверьте поля блока",
    };
  }

  await logCardioBlock(user.id, parsed.data.cardioId, {
    blockId: parsed.data.blockId,
    actualDurationSec: parsed.data.actualDurationSec,
    hrAvg: parsed.data.hrAvg,
    rpe: parsed.data.rpe,
    notes: parsed.data.notes,
  });
  revalidatePath(`/cardio/${parsed.data.cardioId}`);
  return { status: "idle" };
}

const finishSchema = z.object({ cardioId: z.string().uuid() });

export async function finishCardioAction(formData: FormData) {
  const user = await requireUser();
  const parsed = finishSchema.safeParse({
    cardioId: formData.get("cardioId"),
  });
  if (!parsed.success) throw new Error("Bad cardioId");
  await finishCardioWorkout(user.id, parsed.data.cardioId);
  revalidatePath(`/cardio/${parsed.data.cardioId}`);
  revalidatePath("/cardio");
  revalidatePath("/dashboard");
  redirect(`/cardio/${parsed.data.cardioId}`);
}

export async function cancelCardioAction(formData: FormData) {
  const user = await requireUser();
  const parsed = finishSchema.safeParse({
    cardioId: formData.get("cardioId"),
  });
  if (!parsed.success) throw new Error("Bad cardioId");
  await cancelCardioWorkout(user.id, parsed.data.cardioId);
  revalidatePath(`/cardio/${parsed.data.cardioId}`);
  revalidatePath("/cardio");
  revalidatePath("/dashboard");
  redirect("/cardio");
}
