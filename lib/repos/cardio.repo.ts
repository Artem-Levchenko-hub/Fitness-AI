import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  presetToBlocks,
  type CardioPresetKind,
  type CustomParams,
} from "@/lib/domain";

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
): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const blocks = presetToBlocks(input.preset, input.params);
    if (blocks.length === 0) {
      throw new Error("Preset не дал ни одного блока");
    }

    // Один активный сеанс на формат: закрываем брошенные active-кардио юзера,
    // чтобы resume-баннер не «висел» (G2) — незавершённые сессии иначе копятся.
    await tx
      .update(schema.cardioWorkouts)
      .set({ status: "cancelled", finishedAt: new Date() })
      .where(
        and(
          eq(schema.cardioWorkouts.userId, userId),
          eq(schema.cardioWorkouts.status, "active"),
        ),
      );

    const cardioId = crypto.randomUUID();
    const planJson: Record<string, unknown> = {
      preset: input.preset,
      blockCount: blocks.length,
    };
    if (input.params) Object.assign(planJson, input.params);

    await tx.insert(schema.cardioWorkouts).values({
      id: cardioId,
      userId,
      name: input.name,
      preset: input.preset,
      planJson,
      status: "active",
    });

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
): Promise<void> {
  await db.transaction(async (tx) => {
    const [w] = await tx
      .select({ id: schema.cardioWorkouts.id })
      .from(schema.cardioWorkouts)
      .where(
        and(
          eq(schema.cardioWorkouts.id, cardioId),
          eq(schema.cardioWorkouts.userId, userId),
        ),
      )
      .limit(1);
    if (!w) throw new Error("Cardio не найдено или не твоё");

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
    if (!b) throw new Error("Блок не относится к этому кардио");

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
): Promise<void> {
  await db
    .update(schema.cardioWorkouts)
    .set({ status: "completed", finishedAt: new Date() })
    .where(
      and(
        eq(schema.cardioWorkouts.id, cardioId),
        eq(schema.cardioWorkouts.userId, userId),
        eq(schema.cardioWorkouts.status, "active"),
      ),
    );
}

export async function cancelCardioWorkout(
  userId: string,
  cardioId: string,
): Promise<void> {
  await db
    .update(schema.cardioWorkouts)
    .set({ status: "cancelled", finishedAt: new Date() })
    .where(
      and(
        eq(schema.cardioWorkouts.id, cardioId),
        eq(schema.cardioWorkouts.userId, userId),
        eq(schema.cardioWorkouts.status, "active"),
      ),
    );
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
