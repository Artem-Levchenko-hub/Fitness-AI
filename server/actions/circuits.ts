"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { requireUser } from "@/lib/auth/require-user";
import { env } from "@/lib/env";
import {
  cancelCircuit,
  cloneCircuit,
  deleteCircuit,
  finishCircuit,
  logCircuitRound,
  startCircuit,
} from "@/lib/repos/circuits.repo";

/** Триггер AI-воркера сразу после finish — fire-and-forget. */
function triggerWorker(): void {
  if (!env.CRON_SECRET) return;
  try {
    void fetch(`${env.NEXT_PUBLIC_APP_URL}/api/cron/process-ai-jobs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    });
  } catch {
    /* пусто */
  }
}

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

const startSchema = z.object({
  name: z.string().min(1).max(80),
  totalRounds: z.coerce.number().int().min(1).max(30),
  restBetweenRoundsSec: z.coerce.number().int().min(0).max(60 * 60),
  restBetweenExercisesSec: z.coerce.number().int().min(0).max(60 * 60),
  exercises: z.array(exerciseInputSchema).min(1).max(20),
});

export type StartCircuitState =
  | { status: "idle" }
  | { status: "error"; message: string };

/** Использует payload (JSON) — TemplateBuilder pattern, чтобы передать
 *  массив упражнений целиком (а не плоский FormData). */
export async function startCircuitAction(formData: FormData) {
  const user = await requireUser();
  const raw = formData.get("payload");
  if (typeof raw !== "string") {
    throw new Error("Отсутствует payload круговой");
  }

  let parsed;
  try {
    parsed = startSchema.parse(JSON.parse(raw));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Неверный payload";
    throw new Error(`Параметры круговой неверны: ${msg}`);
  }

  // Доп. валидация: у kind=reps должен быть targetReps; у duration — targetDurationSec.
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

  const { id } = await startCircuit(user.id, parsed);

  revalidatePath("/circuits");
  revalidatePath("/dashboard");
  redirect(`/circuits/${id}`);
}

const reRunSchema = z.object({ circuitId: z.string().uuid() });

/** G7b: повтор круговой одним кликом (из «Сегодня по расписанию» / истории) —
 *  клонирует план в новый активный сеанс и ведёт сразу на него. */
export async function reRunCircuitAction(formData: FormData) {
  const user = await requireUser();
  const parsed = reRunSchema.safeParse({
    circuitId: formData.get("circuitId"),
  });
  if (!parsed.success) throw new Error("Invalid circuitId");

  const { id } = await cloneCircuit(user.id, parsed.data.circuitId);
  revalidatePath("/dashboard");
  revalidatePath("/workouts");
  redirect(`/circuits/${id}`);
}

const logRoundSchema = z.object({
  circuitId: z.string().uuid(),
  circuitExerciseId: z.string().uuid(),
  roundNumber: z.coerce.number().int().min(1).max(60),
  actualReps: z
    .union([z.coerce.number().int().min(0).max(500), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v == null ? null : Number(v))),
  actualDurationSec: z
    .union([z.coerce.number().int().min(0).max(60 * 60), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v == null ? null : Number(v))),
  actualWeightKg: z
    .union([z.coerce.number().min(0).max(1000), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v == null ? null : Number(v))),
  rpe: z
    .union([z.coerce.number().min(1).max(10), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v == null ? null : Number(v))),
  skipped: z
    .union([z.literal("true"), z.literal("false"), z.literal(""), z.null()])
    .optional()
    .transform((v) => v === "true"),
});

export type LogRoundState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

export async function logRoundAction(
  _prev: LogRoundState,
  formData: FormData,
): Promise<LogRoundState> {
  const user = await requireUser();
  const parsed = logRoundSchema.safeParse({
    circuitId: formData.get("circuitId"),
    circuitExerciseId: formData.get("circuitExerciseId"),
    roundNumber: formData.get("roundNumber"),
    actualReps: formData.get("actualReps") ?? undefined,
    actualDurationSec: formData.get("actualDurationSec") ?? undefined,
    actualWeightKg: formData.get("actualWeightKg") ?? undefined,
    rpe: formData.get("rpe") ?? undefined,
    skipped: formData.get("skipped") ?? undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Проверьте поля раунда",
    };
  }

  await logCircuitRound(user.id, parsed.data.circuitId, {
    circuitExerciseId: parsed.data.circuitExerciseId,
    roundNumber: parsed.data.roundNumber,
    actualReps: parsed.data.actualReps,
    actualDurationSec: parsed.data.actualDurationSec,
    actualWeightKg: parsed.data.actualWeightKg,
    rpe: parsed.data.rpe,
    skipped: parsed.data.skipped,
  });

  revalidatePath(`/circuits/${parsed.data.circuitId}`);
  return { status: "success" };
}

const finishSchema = z.object({
  circuitId: z.string().uuid(),
  notes: z.string().max(500).optional().nullable(),
});

export async function finishCircuitAction(formData: FormData) {
  const user = await requireUser();
  const parsed = finishSchema.safeParse({
    circuitId: formData.get("circuitId"),
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) throw new Error("Bad circuitId");

  await finishCircuit(user.id, parsed.data.circuitId, parsed.data.notes);

  // AI job (kind=circuit_post_workout). Без дубликата (если уже есть).
  const [existing] = await db
    .select({ id: schema.aiJobs.id })
    .from(schema.aiJobs)
    .where(
      and(
        eq(schema.aiJobs.circuitWorkoutId, parsed.data.circuitId),
        eq(schema.aiJobs.kind, "circuit_post_workout"),
      ),
    )
    .limit(1);

  if (!existing) {
    await db.insert(schema.aiJobs).values({
      userId: user.id,
      circuitWorkoutId: parsed.data.circuitId,
      kind: "circuit_post_workout",
      status: "pending",
    });
    triggerWorker();
  }

  revalidatePath(`/circuits/${parsed.data.circuitId}`);
  revalidatePath("/circuits");
  revalidatePath("/dashboard");
  redirect(`/circuits/${parsed.data.circuitId}`);
}

export async function cancelCircuitAction(formData: FormData) {
  const user = await requireUser();
  const parsed = finishSchema.safeParse({
    circuitId: formData.get("circuitId"),
    notes: null,
  });
  if (!parsed.success) throw new Error("Bad circuitId");
  await cancelCircuit(user.id, parsed.data.circuitId);
  revalidatePath(`/circuits/${parsed.data.circuitId}`);
  revalidatePath("/circuits");
  revalidatePath("/workouts");
  revalidatePath("/dashboard");
  redirect("/workouts");
}

const deleteSchema = z.object({ circuitId: z.string().uuid() });

export async function deleteCircuitAction(formData: FormData) {
  const user = await requireUser();
  const parsed = deleteSchema.safeParse({
    circuitId: formData.get("circuitId"),
  });
  if (!parsed.success) throw new Error("Bad circuitId");
  await deleteCircuit(user.id, parsed.data.circuitId);
  revalidatePath("/circuits");
  revalidatePath("/dashboard");
  redirect("/circuits");
}
