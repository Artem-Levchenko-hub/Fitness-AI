import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUser } from "@/lib/auth/require-user";
import {
  cancelCardioWorkout,
  finishCardioWorkout,
  getActiveCardioId,
  getCardioForUser,
  listRecentCardio,
  logCardioBlock,
  startCardioFromPreset,
} from "@/lib/repos/cardio.repo";
import { listCardioTemplates, startCardioFromTemplate } from "@/lib/repos/cardio-templates.repo";
import {
  cancelCircuit,
  getActiveCircuitId,
  getCircuitForUser,
  listCircuits,
  logCircuitRound,
  startCircuit,
} from "@/lib/repos/circuits.repo";
import { listCircuitTemplates, startCircuitFromTemplate } from "@/lib/repos/circuit-templates.repo";
import { listExercises } from "@/lib/repos/exercises.repo";
import { FormatWriteError } from "@/lib/repos/training-format-write";
import { finishCircuitWorkout } from "@/server/finish-circuit-workout";

const formatKind = z.enum(["cardio", "circuit"]);
const id = z.uuid().transform((value) => value.toLowerCase());
const selectionSchema = z.object({ kind: formatKind, id });
const accountId = z.string().min(1).max(128);
const name = z.string().trim().min(1).max(80);
const duration = z.number().int().min(0).max(3600);
const notes = z.string().trim().max(500).nullish();
const rpe = z.number().min(1).max(10).nullish();
const weight = z.number().min(0).max(1000).nullish();

const exerciseBase = z.object({
  exerciseId: id,
  targetWeightKg: weight,
  notes: z.string().trim().max(300).nullish(),
});
const circuitExercise = z.discriminatedUnion("kind", [
  exerciseBase.extend({ kind: z.literal("reps"), targetReps: z.number().int().min(1).max(500) }),
  exerciseBase.extend({
    kind: z.literal("duration"),
    targetDurationSec: z.number().int().min(1).max(3600),
  }),
]);

const start = z.object({ accountId, action: z.literal("start"), clientWorkoutId: id, name });
const writeSchema = z.union([
  start.extend({
    kind: z.literal("cardio"),
    preset: z.enum(["tabata", "norwegian_4x4", "emom", "custom"]),
    rounds: z.number().int().min(1).max(60).optional(),
    workSec: z.number().int().min(5).max(3600).optional(),
    restSec: duration.optional(),
    emomRounds: z.number().int().min(1).max(60).optional(),
  }),
  start.extend({
    kind: z.literal("circuit"),
    totalRounds: z.number().int().min(1).max(30),
    restBetweenRoundsSec: duration,
    restBetweenExercisesSec: duration,
    exercises: z.array(circuitExercise).min(1).max(20),
  }),
  z.object({ accountId, kind: formatKind, action: z.literal("start_template"), clientWorkoutId: id, templateId: id }),
  z.object({
    accountId, kind: z.literal("cardio"), action: z.literal("log"), workoutId: id,
    blockId: id, actualDurationSec: duration, hrAvg: z.number().int().min(30).max(240).nullish(), rpe, notes,
  }),
  z.object({
    accountId, kind: z.literal("circuit"), action: z.literal("log"), workoutId: id,
    circuitExerciseId: id, roundNumber: z.number().int().min(1).max(60),
    actualReps: z.number().int().min(0).max(500).nullish(), actualDurationSec: duration.nullish(),
    actualWeightKg: weight, rpe, skipped: z.boolean().optional(),
  }),
  z.object({ accountId, kind: formatKind, action: z.enum(["finish", "cancel"]), workoutId: id, notes }),
]);

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

function revalidateFormat(kind: z.infer<typeof formatKind>, workoutId: string) {
  const path = kind === "cardio" ? "/cardio" : "/circuits";
  revalidatePath(`${path}/${workoutId}`);
  revalidatePath(path);
  revalidatePath("/workouts");
  revalidatePath("/dashboard");
}

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return json({ error: "sign_in_required" }, 401);

  const { searchParams } = new URL(request.url);
  if (searchParams.get("exercises") === "1") {
    const exercises = await listExercises(user.id);
    return json({
      accountId: user.id,
      exercises: exercises.map(({ id, nameRu, nameEn }) => ({ id, nameRu, nameEn })),
    });
  }
  if (searchParams.has("kind") || searchParams.has("id")) {
    const parsed = selectionSchema.safeParse({ kind: searchParams.get("kind"), id: searchParams.get("id") });
    if (!parsed.success) return json({ error: "invalid_format_request" }, 400);
    const detail = parsed.data.kind === "cardio"
      ? await getCardioForUser(user.id, parsed.data.id)
      : await getCircuitForUser(user.id, parsed.data.id);
    if (!detail) return json({ error: "workout_not_found" }, 404);
    const { workout, ...entries } = detail;
    return json({
      accountId: user.id,
      workout: {
        id: workout.id,
        name: workout.name,
        status: workout.status,
        startedAt: workout.startedAt,
        finishedAt: workout.finishedAt,
        notes: workout.notes,
        ...("totalRounds" in workout ? {
          totalRounds: workout.totalRounds,
          restBetweenRoundsSec: workout.restBetweenRoundsSec,
          restBetweenExercisesSec: workout.restBetweenExercisesSec,
        } : { preset: workout.preset }),
      },
      ...entries,
    });
  }

  const [cardioActiveId, cardioRecent, cardioTemplates, circuitActiveId, circuitRecent, circuitTemplates] =
    await Promise.all([
      getActiveCardioId(user.id), listRecentCardio(user.id), listCardioTemplates(user.id),
      getActiveCircuitId(user.id), listCircuits(user.id), listCircuitTemplates(user.id),
    ]);
  return json({
    accountId: user.id,
    cardio: { activeId: cardioActiveId, recent: cardioRecent, templates: cardioTemplates },
    circuit: { activeId: circuitActiveId, recent: circuitRecent, templates: circuitTemplates },
  });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return json({ error: "sign_in_required" }, 401);
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") return json({ error: "invalid_content_type" }, 415);

  const parsed = writeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_format_request" }, 400);
  const data = parsed.data;
  const { accountId: expectedAccount, kind, action } = data;
  if (expectedAccount !== user.id) return json({ error: "account_changed" }, 409);

  try {
    if (data.action === "start" || data.action === "start_template") {
      const { clientWorkoutId } = data;
      const existing = kind === "cardio"
        ? await getCardioForUser(user.id, clientWorkoutId)
        : await getCircuitForUser(user.id, clientWorkoutId);
      if (existing) return json({ workoutId: existing.workout.id });

      const options = { clientWorkoutId };
      let result: { id: string };
      if (data.action === "start_template") {
        result = kind === "cardio"
          ? await startCardioFromTemplate(user.id, data.templateId, options)
          : await startCircuitFromTemplate(user.id, data.templateId, options);
      } else if (data.kind === "cardio") {
        const { name, preset, rounds, workSec, restSec, emomRounds } = data;
        result = await startCardioFromPreset(user.id, {
          name, preset, params: { rounds, workSec, restSec, emomRounds },
        }, options);
      } else {
        const { name, totalRounds, restBetweenRoundsSec, restBetweenExercisesSec, exercises } = data;
        const available = new Set((await listExercises(user.id)).map((exercise) => exercise.id));
        if (exercises.some((exercise) => !available.has(exercise.exerciseId))) {
          return json({ error: "exercise_not_found" }, 404);
        }
        result = await startCircuit(user.id, { name, totalRounds, restBetweenRoundsSec, restBetweenExercisesSec, exercises }, options);
      }
      revalidateFormat(kind, result.id);
      return json({ workoutId: result.id });
    }

    const { workoutId } = data;
    if (data.action === "log") {
      if (data.kind === "cardio") {
        const { blockId, actualDurationSec, hrAvg, rpe, notes } = data;
        await logCardioBlock(user.id, workoutId, { blockId, actualDurationSec, hrAvg, rpe, notes }, { activeOnly: true });
      } else {
        const { circuitExerciseId, roundNumber, actualReps, actualDurationSec, actualWeightKg, rpe, skipped } = data;
        await logCircuitRound(user.id, workoutId, {
          circuitExerciseId, roundNumber, actualReps, actualDurationSec, actualWeightKg, rpe, skipped,
        }, { activeOnly: true });
      }
      revalidateFormat(kind, workoutId);
      return json({ workoutId });
    }

    const result = action === "finish"
      ? kind === "cardio"
        ? await finishCardioWorkout(user.id, workoutId, data.notes)
        : await finishCircuitWorkout(user.id, workoutId, data.notes)
      : kind === "cardio"
        ? await cancelCardioWorkout(user.id, workoutId)
        : await cancelCircuit(user.id, workoutId);
    if (result === "workout_not_found") return json({ error: result }, 404);
    if (result === "workout_status_conflict") return json({ error: result }, 409);
    if (result === "changed") revalidateFormat(kind, workoutId);
    return json({ workoutId });
  } catch (error) {
    if (!(error instanceof FormatWriteError)) throw error;
    const status = error.code === "round_out_of_range" ? 400
      : error.code === "workout_status_conflict" ? 409 : 404;
    return json({ error: error.code }, status);
  }
}
