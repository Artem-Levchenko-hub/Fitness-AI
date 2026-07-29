import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  DEFAULT_MYO_MINI_SETS,
  DEFAULT_MYO_FIRST_REST_SECONDS,
  DEFAULT_MYO_REPS_PERCENT,
  DEFAULT_MYO_REST_SECONDS,
} from "@/lib/domain/workouts/myo-reps";

type TemplateTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type TemplateVersionSnapshot = schema.PreAdaptSnapshotItem[];

export async function loadTemplateSnapshot(
  tx: TemplateTx,
  templateId: string,
): Promise<TemplateVersionSnapshot> {
  return tx
    .select({
      exerciseId: schema.templateExercises.exerciseId,
      position: schema.templateExercises.position,
      targetSets: schema.templateExercises.targetSets,
      targetRepsMin: schema.templateExercises.targetRepsMin,
      targetRepsMax: schema.templateExercises.targetRepsMax,
      targetWeightKg: schema.templateExercises.targetWeightKg,
      targetRestSeconds: schema.templateExercises.targetRestSeconds,
      setScheme: schema.templateExercises.setScheme,
      myoMiniSets: schema.templateExercises.myoMiniSets,
      myoRepsPercent: schema.templateExercises.myoRepsPercent,
      myoRestSeconds: schema.templateExercises.myoRestSeconds,
      myoFirstRestSeconds: schema.templateExercises.myoFirstRestSeconds,
      notes: schema.templateExercises.notes,
    })
    .from(schema.templateExercises)
    .where(eq(schema.templateExercises.templateId, templateId))
    .orderBy(asc(schema.templateExercises.position));
}

export async function createInitialTemplateVersion(
  tx: TemplateTx,
  templateId: string,
  summary = "Исходная версия",
): Promise<void> {
  const [existing] = await tx
    .select({ id: schema.templateVersions.id })
    .from(schema.templateVersions)
    .where(
      and(
        eq(schema.templateVersions.templateId, templateId),
        eq(schema.templateVersions.versionNumber, 1),
      ),
    )
    .limit(1);
  if (existing) return;

  const snapshot = await loadTemplateSnapshot(tx, templateId);
  await tx
    .insert(schema.templateVersions)
    .values({
      templateId,
      versionNumber: 1,
      source: "manual",
      snapshot,
      summary,
      confirmedAt: new Date(),
    })
    .onConflictDoNothing();
}

export type AppendTemplateVersionInput = {
  templateId: string;
  source: schema.TemplateVersionSource;
  sourceWorkoutId?: string | null;
  summary: string;
  rationale?: string | null;
  confidence?: number | null;
  requiresConfirmation?: boolean;
  confirmed?: boolean;
};

export async function appendTemplateVersion(
  tx: TemplateTx,
  input: AppendTemplateVersionInput,
): Promise<number> {
  const [template] = await tx
    .select({
      currentVersion: schema.workoutTemplates.currentVersion,
    })
    .from(schema.workoutTemplates)
    .where(eq(schema.workoutTemplates.id, input.templateId))
    .for("update")
    .limit(1);
  if (!template) throw new Error("Template not found");

  const [latest] = await tx
    .select({ versionNumber: schema.templateVersions.versionNumber })
    .from(schema.templateVersions)
    .where(eq(schema.templateVersions.templateId, input.templateId))
    .orderBy(desc(schema.templateVersions.versionNumber))
    .limit(1);
  const versionNumber = Math.max(
    template.currentVersion,
    latest?.versionNumber ?? 0,
  ) + 1;
  const snapshot = await loadTemplateSnapshot(tx, input.templateId);
  await tx.insert(schema.templateVersions).values({
    templateId: input.templateId,
    versionNumber,
    source: input.source,
    sourceWorkoutId: input.sourceWorkoutId ?? null,
    snapshot,
    summary: input.summary,
    rationale: input.rationale ?? null,
    confidence: input.confidence ?? null,
    requiresConfirmation: input.requiresConfirmation ?? false,
    confirmedAt: input.confirmed ? new Date() : null,
  });
  await tx
    .update(schema.workoutTemplates)
    .set({ currentVersion: versionNumber })
    .where(eq(schema.workoutTemplates.id, input.templateId));

  return versionNumber;
}

export async function createPendingTemplateVersion(
  tx: TemplateTx,
  input: Omit<AppendTemplateVersionInput, "requiresConfirmation" | "confirmed"> & {
    snapshot: TemplateVersionSnapshot;
  },
): Promise<number> {
  const [template] = await tx
    .select({ currentVersion: schema.workoutTemplates.currentVersion })
    .from(schema.workoutTemplates)
    .where(eq(schema.workoutTemplates.id, input.templateId))
    .for("update")
    .limit(1);
  if (!template) throw new Error("Template not found");
  const [latest] = await tx
    .select({ versionNumber: schema.templateVersions.versionNumber })
    .from(schema.templateVersions)
    .where(eq(schema.templateVersions.templateId, input.templateId))
    .orderBy(desc(schema.templateVersions.versionNumber))
    .limit(1);
  const versionNumber = Math.max(
    template.currentVersion,
    latest?.versionNumber ?? 0,
  ) + 1;
  await tx.insert(schema.templateVersions).values({
    templateId: input.templateId,
    versionNumber,
    source: input.source,
    sourceWorkoutId: input.sourceWorkoutId ?? null,
    snapshot: input.snapshot,
    summary: input.summary,
    rationale: input.rationale ?? null,
    confidence: input.confidence ?? null,
    requiresConfirmation: true,
  });
  return versionNumber;
}

export type TemplateVersionListItem = {
  id: string;
  versionNumber: number;
  source: schema.TemplateVersionSource;
  sourceWorkoutId: string | null;
  summary: string;
  rationale: string | null;
  confidence: number | null;
  requiresConfirmation: boolean;
  confirmedAt: Date | null;
  createdAt: Date;
  snapshot: TemplateVersionSnapshot;
};

export async function listTemplateVersions(
  userId: string,
  templateId: string,
  limit = 10,
): Promise<TemplateVersionListItem[]> {
  return db
    .select({
      id: schema.templateVersions.id,
      versionNumber: schema.templateVersions.versionNumber,
      source: schema.templateVersions.source,
      sourceWorkoutId: schema.templateVersions.sourceWorkoutId,
      summary: schema.templateVersions.summary,
      rationale: schema.templateVersions.rationale,
      confidence: schema.templateVersions.confidence,
      requiresConfirmation: schema.templateVersions.requiresConfirmation,
      confirmedAt: schema.templateVersions.confirmedAt,
      createdAt: schema.templateVersions.createdAt,
      snapshot: schema.templateVersions.snapshot,
    })
    .from(schema.templateVersions)
    .innerJoin(
      schema.workoutTemplates,
      eq(schema.workoutTemplates.id, schema.templateVersions.templateId),
    )
    .where(
      and(
        eq(schema.templateVersions.templateId, templateId),
        eq(schema.workoutTemplates.userId, userId),
      ),
    )
    .orderBy(desc(schema.templateVersions.versionNumber))
    .limit(limit);
}

export async function confirmTemplateVersion(
  userId: string,
  templateId: string,
  versionId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [owned] = await tx
      .select({
        id: schema.templateVersions.id,
        versionNumber: schema.templateVersions.versionNumber,
        sourceWorkoutId: schema.templateVersions.sourceWorkoutId,
        snapshot: schema.templateVersions.snapshot,
        requiresConfirmation: schema.templateVersions.requiresConfirmation,
        currentVersion: schema.workoutTemplates.currentVersion,
      })
      .from(schema.templateVersions)
      .innerJoin(
        schema.workoutTemplates,
        eq(schema.workoutTemplates.id, schema.templateVersions.templateId),
      )
      .where(
        and(
          eq(schema.templateVersions.id, versionId),
          eq(schema.templateVersions.templateId, templateId),
          eq(schema.workoutTemplates.userId, userId),
        ),
      )
      .for("update")
      .limit(1);
    if (!owned) throw new Error("Template version not found");
    if (
      owned.requiresConfirmation &&
      owned.versionNumber > owned.currentVersion
    ) {
      await tx
        .delete(schema.templateExercises)
        .where(eq(schema.templateExercises.templateId, templateId));
      if (owned.snapshot.length > 0) {
        await tx.insert(schema.templateExercises).values(
          owned.snapshot.map((item, position) => ({
            templateId,
            exerciseId: item.exerciseId,
            position,
            targetSets: item.targetSets,
            targetRepsMin: item.targetRepsMin,
            targetRepsMax: item.targetRepsMax,
            targetWeightKg: item.targetWeightKg,
            targetRestSeconds: item.targetRestSeconds,
            setScheme: item.setScheme ?? "straight",
            myoMiniSets: item.myoMiniSets ?? DEFAULT_MYO_MINI_SETS,
            myoRepsPercent: item.myoRepsPercent ?? DEFAULT_MYO_REPS_PERCENT,
            myoRestSeconds: item.myoRestSeconds ?? DEFAULT_MYO_REST_SECONDS,
            myoFirstRestSeconds:
              item.myoFirstRestSeconds ?? DEFAULT_MYO_FIRST_REST_SECONDS,
            notes: item.notes,
          })),
        );
      }
      await tx
        .update(schema.workoutTemplates)
        .set({
          currentVersion: owned.versionNumber,
          lastAdaptedWorkoutId: owned.sourceWorkoutId,
          adaptedAt: new Date(),
        })
        .where(eq(schema.workoutTemplates.id, templateId));
    }
    await tx
      .update(schema.templateVersions)
      .set({ confirmedAt: new Date() })
      .where(eq(schema.templateVersions.id, versionId));
  });
}

export async function restoreTemplateVersion(
  userId: string,
  templateId: string,
  versionId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [version] = await tx
      .select({
        snapshot: schema.templateVersions.snapshot,
        versionNumber: schema.templateVersions.versionNumber,
      })
      .from(schema.templateVersions)
      .innerJoin(
        schema.workoutTemplates,
        eq(schema.workoutTemplates.id, schema.templateVersions.templateId),
      )
      .where(
        and(
          eq(schema.templateVersions.id, versionId),
          eq(schema.templateVersions.templateId, templateId),
          eq(schema.workoutTemplates.userId, userId),
        ),
      )
      .limit(1);
    if (!version) throw new Error("Template version not found");

    await tx
      .delete(schema.templateExercises)
      .where(eq(schema.templateExercises.templateId, templateId));
    if (version.snapshot.length > 0) {
      await tx.insert(schema.templateExercises).values(
        version.snapshot.map((item, position) => ({
          templateId,
          exerciseId: item.exerciseId,
          position,
          targetSets: item.targetSets,
          targetRepsMin: item.targetRepsMin,
          targetRepsMax: item.targetRepsMax,
          targetWeightKg: item.targetWeightKg,
          targetRestSeconds: item.targetRestSeconds,
          setScheme: item.setScheme ?? "straight",
          myoMiniSets: item.myoMiniSets ?? DEFAULT_MYO_MINI_SETS,
          myoRepsPercent: item.myoRepsPercent ?? DEFAULT_MYO_REPS_PERCENT,
          myoRestSeconds: item.myoRestSeconds ?? DEFAULT_MYO_REST_SECONDS,
          myoFirstRestSeconds:
            item.myoFirstRestSeconds ?? DEFAULT_MYO_FIRST_REST_SECONDS,
          notes: item.notes,
        })),
      );
    }

    await tx
      .update(schema.workoutTemplates)
      .set({
        adaptOptOut: true,
        lastAdaptedWorkoutId: null,
        adaptedAt: new Date(),
      })
      .where(eq(schema.workoutTemplates.id, templateId));
    await appendTemplateVersion(tx, {
      templateId,
      source: "rollback",
      summary: `Откат к версии ${version.versionNumber}`,
      rationale:
        "Предыдущая версия сохранена в истории. Автокоррекция приостановлена до повторного включения.",
      confirmed: true,
    });
  });
}
