import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  presetToBlocks,
  type CardioPresetKind,
  type CustomParams,
} from "@/lib/domain";
import { FormatWriteError, type FormatStartOptions, type FormatTransition } from "./training-format-write";

export type CardioSummary = {
  id: string;
  name: string;
  preset: CardioPresetKind;
  status: (typeof schema.workoutStatus.enumValues)[number];
  startedAt: Date;
  finishedAt: Date | null;
  totalPlannedSec: number;
  totalActualSec: number;
  workBlockCount: number;
  completedWorkCount: number;
  hrAvg: number | null;
};

export type CardioWithBlocks = {
  workout: schema.CardioWorkout;
  blocks: schema.CardioBlock[];
};

export async function startCardioFromPreset(
  userId: string,
  input: {
    preset: CardioPresetKind;
    name: string;
    params?: Partial<CustomParams> & { emomRounds?: number };
  },
  options?: FormatStartOptions,
): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`cardio-start:${userId}`}, 0))`);
    if (options?.clientWorkoutId) {
      const [replay] = await tx.select({ id: schema.cardioWorkouts.id }).from(schema.cardioWorkouts)
        .where(and(eq(schema.cardioWorkouts.id, options.clientWorkoutId), eq(schema.cardioWorkouts.userId, userId))).limit(1);
      if (replay) return replay;
    }
    const [active] = await tx.select({ id: schema.cardioWorkouts.id }).from(schema.cardioWorkouts)
      .where(and(eq(schema.cardioWorkouts.userId, userId), eq(schema.cardioWorkouts.status, "active")))
      .orderBy(desc(schema.cardioWorkouts.startedAt)).limit(1);
    if (active) return active;
    const blocks = presetToBlocks(input.preset, input.params);
    if (blocks.length === 0) {
      throw new Error("Preset не дал ни одного блока");
    }

    const cardioId = options?.clientWorkoutId ?? crypto.randomUUID();
    const planJson: Record<string, unknown> = {
      preset: input.preset,
      blockCount: blocks.length,
    };
    if (input.params) Object.assign(planJson, input.params);

    const [inserted] = await tx.insert(schema.cardioWorkouts).values({
      id: cardioId,
      userId,
      name: input.name,
      preset: input.preset,
      planJson,
      status: "active",
    }).onConflictDoNothing({ target: schema.cardioWorkouts.id }).returning({ id: schema.cardioWorkouts.id });
    if (!inserted) {
      const [existing] = await tx.select({ id: schema.cardioWorkouts.id })
        .from(schema.cardioWorkouts)
        .where(and(eq(schema.cardioWorkouts.id, cardioId), eq(schema.cardioWorkouts.userId, userId)))
        .limit(1);
      if (existing) return existing;
      throw new FormatWriteError("workout_status_conflict", "Не удалось начать кардио");
    }

    await tx.insert(schema.cardioBlocks).values(
      blocks.map((b, i) => ({
        cardioWorkoutId: cardioId,
        blockIndex: i,
        kind: b.kind,
        label: b.label,
        plannedDurationSec: b.durationSec,
      })),
    );

    return { id: cardioId };
  });
}

export async function getCardioForUser(
  userId: string,
  cardioId: string,
): Promise<CardioWithBlocks | null> {
  const [w] = await db
    .select()
    .from(schema.cardioWorkouts)
    .where(
      and(
        eq(schema.cardioWorkouts.id, cardioId),
        eq(schema.cardioWorkouts.userId, userId),
      ),
    )
    .limit(1);
  if (!w) return null;

  const blocks = await db
    .select()
    .from(schema.cardioBlocks)
    .where(eq(schema.cardioBlocks.cardioWorkoutId, cardioId))
    .orderBy(asc(schema.cardioBlocks.blockIndex));

  return { workout: w, blocks };
}

/** G7b re-run: клонирует прошлое кардио юзера в НОВЫЙ активный сеанс — копирует
 *  план (имя, preset, planJson, блоки с плановой длительностью), но НЕ фактические
 *  результаты (свежий старт). Копируем блоки напрямую, не пере-выводя из preset
 *  (точнее для custom-параметров). Незавершённая сессия сначала возобновляется.
 *  R-7: getCardioForUser фильтрует по userId, чужую не клонируем. */
export async function cloneCardio(
  userId: string,
  sourceId: string,
): Promise<{ id: string }> {
  const src = await getCardioForUser(userId, sourceId);
  if (!src) throw new Error("Кардио не найдено или не твоё");
  if (src.blocks.length === 0) throw new Error("В кардио нет блоков для повтора");

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`cardio-start:${userId}`}, 0))`);
    const [active] = await tx.select({ id: schema.cardioWorkouts.id }).from(schema.cardioWorkouts)
      .where(and(eq(schema.cardioWorkouts.userId, userId), eq(schema.cardioWorkouts.status, "active")))
      .orderBy(desc(schema.cardioWorkouts.startedAt)).limit(1);
    if (active) return active;

    const cardioId = crypto.randomUUID();
    await tx.insert(schema.cardioWorkouts).values({
      id: cardioId,
      userId,
      name: src.workout.name,
      preset: src.workout.preset,
      planJson: src.workout.planJson,
      status: "active",
    });

    await tx.insert(schema.cardioBlocks).values(
      src.blocks.map((b) => ({
        cardioWorkoutId: cardioId,
        blockIndex: b.blockIndex,
        kind: b.kind,
        label: b.label,
        plannedDurationSec: b.plannedDurationSec,
      })),
    );

    return { id: cardioId };
  });
}

export type LogBlockInput = {
  blockId: string;
  actualDurationSec: number;
  hrAvg?: number | null;
  rpe?: number | null;
  notes?: string | null;
};

export async function logCardioBlock(
  userId: string,
  cardioId: string,
  input: LogBlockInput,
  options?: { activeOnly?: boolean },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [w] = await tx
      .select({ status: schema.cardioWorkouts.status })
      .from(schema.cardioWorkouts)
      .where(
        and(
          eq(schema.cardioWorkouts.id, cardioId),
          eq(schema.cardioWorkouts.userId, userId),
        ),
      )
      .limit(1)
      .for("update");
    if (!w) throw new FormatWriteError("workout_not_found", "Cardio не найдено или не твоё");
    if (options?.activeOnly && w.status !== "active") {
      throw new FormatWriteError("workout_status_conflict", "Кардио уже закрыто");
    }

    const [b] = await tx
      .select({ id: schema.cardioBlocks.id })
      .from(schema.cardioBlocks)
      .where(
        and(
          eq(schema.cardioBlocks.id, input.blockId),
          eq(schema.cardioBlocks.cardioWorkoutId, cardioId),
        ),
      )
      .limit(1);
    if (!b) throw new FormatWriteError("block_not_found", "Блок не относится к этому кардио");

    await tx
      .update(schema.cardioBlocks)
      .set({
        actualDurationSec: input.actualDurationSec,
        hrAvg: input.hrAvg ?? null,
        rpe: input.rpe ?? null,
        notes: input.notes ?? null,
        completedAt: new Date(),
      })
      .where(eq(schema.cardioBlocks.id, input.blockId));
  });
}

export async function finishCardioWorkout(
  userId: string,
  cardioId: string,
  notes?: string | null,
): Promise<FormatTransition> {
  return transitionCardioWorkout(userId, cardioId, "completed", notes);
}

export async function cancelCardioWorkout(
  userId: string,
  cardioId: string,
): Promise<FormatTransition> {
  return transitionCardioWorkout(userId, cardioId, "cancelled");
}

async function transitionCardioWorkout(
  userId: string,
  cardioId: string,
  status: "completed" | "cancelled",
  notes?: string | null,
): Promise<FormatTransition> {
  const owned = and(eq(schema.cardioWorkouts.id, cardioId), eq(schema.cardioWorkouts.userId, userId));
  const trimmed = notes?.trim();
  const [changed] = await db
    .update(schema.cardioWorkouts)
    .set({
      status,
      finishedAt: new Date(),
      // Заметка «как прошло» (G7c feeling-note) — пишем только если непуста,
      // чтобы повторный finish не затирал её в NULL.
      ...(trimmed ? { notes: trimmed.slice(0, 500) } : {}),
    })
    .where(and(owned, eq(schema.cardioWorkouts.status, "active")))
    .returning({ id: schema.cardioWorkouts.id });
  if (changed) return "changed";

  const [existing] = await db.select({ status: schema.cardioWorkouts.status })
    .from(schema.cardioWorkouts).where(owned).limit(1);
  if (!existing) return "workout_not_found";
  return existing.status === status ? "already_applied" : "workout_status_conflict";
}

export async function getActiveCardioId(
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: schema.cardioWorkouts.id })
    .from(schema.cardioWorkouts)
    .where(
      and(
        eq(schema.cardioWorkouts.userId, userId),
        eq(schema.cardioWorkouts.status, "active"),
      ),
    )
    .orderBy(desc(schema.cardioWorkouts.startedAt))
    .limit(1);
  return row?.id ?? null;
}

export async function listRecentCardio(
  userId: string,
  limit = 30,
): Promise<CardioSummary[]> {
  const rows = await db
    .select()
    .from(schema.cardioWorkouts)
    .where(eq(schema.cardioWorkouts.userId, userId))
    .orderBy(desc(schema.cardioWorkouts.startedAt))
    .limit(limit);

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const blocks = await db
    .select()
    .from(schema.cardioBlocks)
    .where(inArray(schema.cardioBlocks.cardioWorkoutId, ids));

  const byCardio = new Map<string, schema.CardioBlock[]>();
  for (const b of blocks) {
    const arr = byCardio.get(b.cardioWorkoutId) ?? [];
    arr.push(b);
    byCardio.set(b.cardioWorkoutId, arr);
  }

  return rows.map((w) => {
    const bs = byCardio.get(w.id) ?? [];
    const work = bs.filter((b) => b.kind === "work");
    const completedWork = work.filter((b) => b.completedAt != null);
    const hrSamples = completedWork
      .map((b) => b.hrAvg)
      .filter((v): v is number => v != null);
    return {
      id: w.id,
      name: w.name,
      preset: w.preset,
      status: w.status,
      startedAt: w.startedAt,
      finishedAt: w.finishedAt,
      totalPlannedSec: bs.reduce((s, b) => s + b.plannedDurationSec, 0),
      totalActualSec: bs.reduce(
        (s, b) => s + (b.actualDurationSec ?? 0),
        0,
      ),
      workBlockCount: work.length,
      completedWorkCount: completedWork.length,
      hrAvg:
        hrSamples.length > 0
          ? Math.round(hrSamples.reduce((s, v) => s + v, 0) / hrSamples.length)
          : null,
    };
  });
}

/** Удаляет кардио-сеанс целиком. Дочерние блоки (`cardioBlocks`) уходят по
 *  ON DELETE CASCADE. Фильтр по userId (R-7) — чужой сеанс удалить нельзя
 *  (0 строк). Зеркало `deleteWorkout` / `deleteCircuit`. */
export async function deleteCardio(
  userId: string,
  cardioId: string,
): Promise<void> {
  await db
    .delete(schema.cardioWorkouts)
    .where(
      and(
        eq(schema.cardioWorkouts.id, cardioId),
        eq(schema.cardioWorkouts.userId, userId),
      ),
    );
}
