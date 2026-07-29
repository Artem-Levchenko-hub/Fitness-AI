import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import type { RefineCurrentItem } from "@/lib/domain/templates/template-refine";
import {
  appendTemplateVersion,
  createInitialTemplateVersion,
} from "@/lib/repos/template-versions.repo";
import {
  DEFAULT_MYO_MINI_SETS,
  DEFAULT_MYO_FIRST_REST_SECONDS,
  DEFAULT_MYO_REPS_PERCENT,
  DEFAULT_MYO_REST_SECONDS,
  type SetScheme,
} from "@/lib/domain/workouts/myo-reps";

export type TemplateSource = "manual" | "trainer";

export type TemplateListItem = {
  id: string;
  name: string;
  description: string | null;
  exerciseCount: number;
  hasMyoReps: boolean;
  updatedAt: Date;
  /** Авторство шаблона — для бейджа «Тренер» (H-T1). */
  source: TemplateSource;
  /** Тренер уже адаптировал шаблон-день под факт (бейдж «обновлён тренером»). */
  adapted: boolean;
  pinnedPosition: number | null;
};

export type TemplateItemInput = {
  exerciseId: string;
  position: number;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  targetWeightKg: number | null;
  targetRestSeconds: number;
  setScheme?: SetScheme;
  myoMiniSets?: number;
  myoRepsPercent?: number;
  myoRestSeconds?: number;
  myoFirstRestSeconds?: number;
  notes?: string | null;
};

export type TemplateItem = Omit<
  TemplateItemInput,
  "setScheme" | "myoMiniSets" | "myoRepsPercent" | "myoRestSeconds" | "myoFirstRestSeconds"
> & {
  id: string;
  exerciseNameRu: string;
  exerciseNameEn: string;
  setScheme: SetScheme;
  myoMiniSets: number;
  myoRepsPercent: number;
  myoRestSeconds: number;
  myoFirstRestSeconds: number;
};

export type TemplateWithItems = {
  id: string;
  name: string;
  description: string | null;
  items: TemplateItem[];
  createdAt: Date;
  updatedAt: Date;
  /** Тренер адаптировал шаблон на месте (non-null = есть корректировка). */
  lastAdaptedWorkoutId: string | null;
  /** Когда тренер в последний раз правил шаблон — для подписи «Улучшено тренером». */
  adaptedAt: Date | null;
  /** Есть снимок оригинала → откат возможен. */
  canRevert: boolean;
  pinnedPosition: number | null;
  currentVersion: number;
};

export async function listTemplates(
  userId: string,
): Promise<TemplateListItem[]> {
  const rows = await db
    .select({
      id: schema.workoutTemplates.id,
      name: schema.workoutTemplates.name,
      description: schema.workoutTemplates.description,
      updatedAt: schema.workoutTemplates.updatedAt,
      source: schema.workoutTemplates.source,
      pinnedPosition: schema.workoutTemplates.pinnedPosition,
      lastAdaptedWorkoutId: schema.workoutTemplates.lastAdaptedWorkoutId,
      exerciseCount: count(schema.templateExercises.id),
      hasMyoReps:
        sql<number>`COALESCE(MAX(CASE WHEN ${schema.templateExercises.setScheme} = 'myo_reps' THEN 1 ELSE 0 END), 0)`,
    })
    .from(schema.workoutTemplates)
    .leftJoin(
      schema.templateExercises,
      eq(schema.templateExercises.templateId, schema.workoutTemplates.id),
    )
    // «Шаблоны» = только то, по чему реально тренируешься: одиночные шаблоны
    // (programId = null) — всегда; дни систем — лишь ПОСЛЕ первой тренировки
    // (lastAdaptedWorkoutId != null, тренер их уже подправил на месте).
    // Неотренированные пресет-дни активной системы живут в Библиотеке, а не
    // засоряют список «Шаблоны».
    .where(
      and(
        eq(schema.workoutTemplates.userId, userId),
        isNull(schema.workoutTemplates.archivedAt),
        or(
          isNull(schema.workoutTemplates.programId),
          isNotNull(schema.workoutTemplates.lastAdaptedWorkoutId),
        ),
      ),
    )
    .groupBy(schema.workoutTemplates.id)
    .orderBy(desc(schema.workoutTemplates.updatedAt));

  return rows.map(({ lastAdaptedWorkoutId, ...r }) => ({
    ...r,
    hasMyoReps: r.hasMyoReps > 0,
    adapted: lastAdaptedWorkoutId != null,
  }));
}

export type PinnedTemplateItem = {
  id: string;
  name: string;
  description: string | null;
  pinnedPosition: number;
  exerciseCount: number;
  hasMyoReps: boolean;
  relevantWorkoutCount: number;
  currentVersion: number;
  latestVersion: {
    id: string;
    versionNumber: number;
    source: schema.TemplateVersionSource;
    summary: string;
    rationale: string | null;
    confidence: number | null;
    requiresConfirmation: boolean;
    confirmedAt: Date | null;
  } | null;
  previousVersionId: string | null;
};

/** Основной поток атлета: только явно закреплённые силовые шаблоны. */
export async function listPinnedTemplates(
  userId: string,
): Promise<PinnedTemplateItem[]> {
  const templates = await db
    .select({
      id: schema.workoutTemplates.id,
      name: schema.workoutTemplates.name,
      description: schema.workoutTemplates.description,
      pinnedPosition: schema.workoutTemplates.pinnedPosition,
      currentVersion: schema.workoutTemplates.currentVersion,
    })
    .from(schema.workoutTemplates)
    .where(
      and(
        eq(schema.workoutTemplates.userId, userId),
        isNull(schema.workoutTemplates.archivedAt),
        isNotNull(schema.workoutTemplates.pinnedPosition),
      ),
    )
    .orderBy(asc(schema.workoutTemplates.pinnedPosition))
    .limit(5);

  return Promise.all(
    templates.map(async (template) => {
      const [[stats], [workoutStats], versions] = await Promise.all([
        db
          .select({
            exerciseCount: count(schema.templateExercises.id),
            hasMyoReps:
              sql<number>`COALESCE(MAX(CASE WHEN ${schema.templateExercises.setScheme} = 'myo_reps' THEN 1 ELSE 0 END), 0)`,
          })
          .from(schema.templateExercises)
          .where(eq(schema.templateExercises.templateId, template.id)),
        db
          .select({ value: count() })
          .from(schema.workouts)
          .where(
            and(
              eq(schema.workouts.userId, userId),
              eq(schema.workouts.templateId, template.id),
              eq(schema.workouts.status, "completed"),
            ),
          ),
        db
          .select({
            id: schema.templateVersions.id,
            versionNumber: schema.templateVersions.versionNumber,
            source: schema.templateVersions.source,
            summary: schema.templateVersions.summary,
            rationale: schema.templateVersions.rationale,
            confidence: schema.templateVersions.confidence,
            requiresConfirmation: schema.templateVersions.requiresConfirmation,
            confirmedAt: schema.templateVersions.confirmedAt,
          })
          .from(schema.templateVersions)
          .where(eq(schema.templateVersions.templateId, template.id))
          .orderBy(desc(schema.templateVersions.versionNumber))
          .limit(2),
      ]);

      return {
        id: template.id,
        name: template.name,
        description: template.description,
        pinnedPosition: template.pinnedPosition!,
        exerciseCount: Number(stats?.exerciseCount ?? 0),
        hasMyoReps: Number(stats?.hasMyoReps ?? 0) > 0,
        relevantWorkoutCount: Number(workoutStats?.value ?? 0),
        currentVersion: template.currentVersion,
        latestVersion: versions[0] ?? null,
        previousVersionId: versions[1]?.id ?? null,
      };
    }),
  );
}

export async function setTemplatePinned(
  userId: string,
  templateId: string,
  pinned: boolean,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [template] = await tx
      .select({ pinnedPosition: schema.workoutTemplates.pinnedPosition })
      .from(schema.workoutTemplates)
      .where(
        and(
          eq(schema.workoutTemplates.id, templateId),
          eq(schema.workoutTemplates.userId, userId),
        ),
      )
      .for("update")
      .limit(1);
    if (!template) throw new Error("Template not found or not yours");

    if (!pinned) {
      await tx
        .update(schema.workoutTemplates)
        .set({ pinnedPosition: null })
        .where(eq(schema.workoutTemplates.id, templateId));
      return;
    }
    if (template.pinnedPosition != null) return;

    const pinnedRows = await tx
      .select({ position: schema.workoutTemplates.pinnedPosition })
      .from(schema.workoutTemplates)
      .where(
        and(
          eq(schema.workoutTemplates.userId, userId),
          isNotNull(schema.workoutTemplates.pinnedPosition),
        ),
      )
      .for("update");
    if (pinnedRows.length >= 5) {
      throw new Error("Можно закрепить не больше пяти тренировок");
    }
    const used = new Set(pinnedRows.map((row) => row.position));
    let position = 1;
    while (used.has(position)) position += 1;
    await tx
      .update(schema.workoutTemplates)
      .set({ pinnedPosition: position })
      .where(eq(schema.workoutTemplates.id, templateId));
  });
}

export async function getTemplateWithItems(
  userId: string,
  templateId: string,
): Promise<TemplateWithItems | null> {
  const [tpl] = await db
    .select()
    .from(schema.workoutTemplates)
    .where(
      and(
        eq(schema.workoutTemplates.id, templateId),
        eq(schema.workoutTemplates.userId, userId),
      ),
    )
    .limit(1);

  if (!tpl) return null;

  const items = await db
    .select({
      id: schema.templateExercises.id,
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
      exerciseNameRu: schema.exercises.nameRu,
      exerciseNameEn: schema.exercises.nameEn,
    })
    .from(schema.templateExercises)
    .innerJoin(
      schema.exercises,
      eq(schema.exercises.id, schema.templateExercises.exerciseId),
    )
    .where(eq(schema.templateExercises.templateId, templateId))
    .orderBy(asc(schema.templateExercises.position));

  return {
    id: tpl.id,
    name: tpl.name,
    description: tpl.description,
    items,
    createdAt: tpl.createdAt,
    updatedAt: tpl.updatedAt,
    lastAdaptedWorkoutId: tpl.lastAdaptedWorkoutId,
    adaptedAt: tpl.adaptedAt,
    canRevert: tpl.preAdaptSnapshot != null,
    pinnedPosition: tpl.pinnedPosition,
    currentVersion: tpl.currentVersion,
  };
}

/** Откат адаптации тренера: восстанавливает оригинальные упражнения шаблона из
 *  снимка (preAdaptSnapshot) и ставит ЛИПКИЙ отказ (adaptOptOut=true) — тренер
 *  больше не переписывает этот шаблон сам, пока атлет не включит заново. Чистит
 *  маркеры адаптации (lastAdaptedWorkoutId/adaptedAt/preAdaptSnapshot). Без
 *  снимка — no-op (нечего восстанавливать). Транзакция, R-7 (гейт по userId). */
export async function revertTemplateAdaptation(
  userId: string,
  templateId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [tpl] = await tx
      .select({ preAdaptSnapshot: schema.workoutTemplates.preAdaptSnapshot })
      .from(schema.workoutTemplates)
      .where(
        and(
          eq(schema.workoutTemplates.id, templateId),
          eq(schema.workoutTemplates.userId, userId),
        ),
      )
      .limit(1);
    if (!tpl) throw new Error("Template not found or not yours");

    const snapshot = tpl.preAdaptSnapshot;
    // Нечего восстанавливать (не адаптирован / уже откатан) — выходим без правок.
    if (snapshot == null) return;

    await tx
      .delete(schema.templateExercises)
      .where(eq(schema.templateExercises.templateId, templateId));

    if (snapshot.length > 0) {
      await tx.insert(schema.templateExercises).values(
        snapshot.map((it, i) => ({
          templateId,
          exerciseId: it.exerciseId,
          position: i,
          targetSets: it.targetSets,
          targetRepsMin: it.targetRepsMin,
          targetRepsMax: it.targetRepsMax,
          targetWeightKg: it.targetWeightKg,
          targetRestSeconds: it.targetRestSeconds,
          setScheme: it.setScheme ?? "straight",
          myoMiniSets: it.myoMiniSets ?? DEFAULT_MYO_MINI_SETS,
          myoRepsPercent: it.myoRepsPercent ?? DEFAULT_MYO_REPS_PERCENT,
          myoRestSeconds: it.myoRestSeconds ?? DEFAULT_MYO_REST_SECONDS,
          myoFirstRestSeconds:
            it.myoFirstRestSeconds ?? DEFAULT_MYO_FIRST_REST_SECONDS,
          notes: it.notes,
        })),
      );
    }

    await tx
      .update(schema.workoutTemplates)
      .set({
        adaptOptOut: true,
        lastAdaptedWorkoutId: null,
        adaptedAt: null,
        preAdaptSnapshot: null,
      })
      .where(eq(schema.workoutTemplates.id, templateId));
  });
}

/** Шаблон, который тренер адаптировал ИМЕННО по этой тренировке — для CTA на
 *  экране разбора («Шаблон обновлён тренером → открыть»). Ключ —
 *  lastAdaptedWorkoutId === workoutId. null, если тренировка не адаптировала
 *  шаблон (ad-hoc, opt-out, ещё не финиширована). R-7: гейт по userId. */
export async function getAdaptedTemplateForWorkout(
  userId: string,
  workoutId: string,
): Promise<{ id: string; name: string } | null> {
  const [row] = await db
    .select({
      id: schema.workoutTemplates.id,
      name: schema.workoutTemplates.name,
    })
    .from(schema.workoutTemplates)
    .where(
      and(
        eq(schema.workoutTemplates.userId, userId),
        eq(schema.workoutTemplates.lastAdaptedWorkoutId, workoutId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export type CreateTemplateInput = {
  name: string;
  description?: string | null;
  items: Omit<TemplateItemInput, "position">[];
};

export async function createTemplate(
  userId: string,
  input: CreateTemplateInput,
): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const id = crypto.randomUUID();
    await tx.insert(schema.workoutTemplates).values({
      id,
      userId,
      name: input.name,
      description: input.description ?? null,
    });

    if (input.items.length > 0) {
      await tx.insert(schema.templateExercises).values(
        input.items.map((it, i) => ({
          templateId: id,
          exerciseId: it.exerciseId,
          position: i,
          targetSets: it.targetSets,
          targetRepsMin: it.targetRepsMin,
          targetRepsMax: it.targetRepsMax,
          targetWeightKg: it.targetWeightKg,
          targetRestSeconds: it.targetRestSeconds,
          setScheme: it.setScheme ?? "straight",
          myoMiniSets: it.myoMiniSets ?? DEFAULT_MYO_MINI_SETS,
          myoRepsPercent: it.myoRepsPercent ?? DEFAULT_MYO_REPS_PERCENT,
          myoRestSeconds: it.myoRestSeconds ?? DEFAULT_MYO_REST_SECONDS,
          myoFirstRestSeconds:
            it.myoFirstRestSeconds ?? DEFAULT_MYO_FIRST_REST_SECONDS,
          notes: it.notes ?? null,
        })),
      );
    }

    await createInitialTemplateVersion(tx, id);
    return { id };
  });
}

export type UpdateTemplateInput = CreateTemplateInput;

export async function updateTemplate(
  userId: string,
  templateId: string,
  input: UpdateTemplateInput,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: schema.workoutTemplates.id })
      .from(schema.workoutTemplates)
      .where(
        and(
          eq(schema.workoutTemplates.id, templateId),
          eq(schema.workoutTemplates.userId, userId),
        ),
      )
      .limit(1);

    if (!existing) throw new Error("Template not found or not yours");

    // Шаблоны библиотеки/AI-плана могли быть созданы другим repo-путём.
    // Перед первой заменой фиксируем их исходное состояние.
    await createInitialTemplateVersion(tx, templateId);

    await tx
      .update(schema.workoutTemplates)
      .set({
        name: input.name,
        description: input.description ?? null,
      })
      .where(eq(schema.workoutTemplates.id, templateId));

    await tx
      .delete(schema.templateExercises)
      .where(eq(schema.templateExercises.templateId, templateId));

    if (input.items.length > 0) {
      await tx.insert(schema.templateExercises).values(
        input.items.map((it, i) => ({
          templateId,
          exerciseId: it.exerciseId,
          position: i,
          targetSets: it.targetSets,
          targetRepsMin: it.targetRepsMin,
          targetRepsMax: it.targetRepsMax,
          targetWeightKg: it.targetWeightKg,
          targetRestSeconds: it.targetRestSeconds,
          setScheme: it.setScheme ?? "straight",
          myoMiniSets: it.myoMiniSets ?? DEFAULT_MYO_MINI_SETS,
          myoRepsPercent: it.myoRepsPercent ?? DEFAULT_MYO_REPS_PERCENT,
          myoRestSeconds: it.myoRestSeconds ?? DEFAULT_MYO_REST_SECONDS,
          myoFirstRestSeconds:
            it.myoFirstRestSeconds ?? DEFAULT_MYO_FIRST_REST_SECONDS,
          notes: it.notes ?? null,
        })),
      );
    }

    await appendTemplateVersion(tx, {
      templateId,
      source: "manual",
      summary: "Шаблон изменён вручную",
      rationale: "Параметры сохранены пользователем в редакторе шаблона.",
      confirmed: true,
    });
  });
}

export async function deleteTemplate(
  userId: string,
  templateId: string,
): Promise<void> {
  await db
    .delete(schema.workoutTemplates)
    .where(
      and(
        eq(schema.workoutTemplates.id, templateId),
        eq(schema.workoutTemplates.userId, userId),
      ),
    );
}

export type TemplateRefineSource = {
  name: string;
  current: RefineCurrentItem[];
};

/** Собирает текущий шаблон для «улучшить с тренером»: имя + упражнения (slug,
 *  имя, первичные группы, целевые параметры, заметка). slug нужен, чтобы LLM
 *  ссылался на упражнения, а apply резолвил их обратно. R-7: гейт по userId.
 *  null — шаблон не найден / не принадлежит атлету. */
export async function getTemplateForRefine(
  userId: string,
  templateId: string,
): Promise<TemplateRefineSource | null> {
  const [tpl] = await db
    .select({ name: schema.workoutTemplates.name })
    .from(schema.workoutTemplates)
    .where(
      and(
        eq(schema.workoutTemplates.id, templateId),
        eq(schema.workoutTemplates.userId, userId),
      ),
    )
    .limit(1);
  if (!tpl) return null;

  const rows = await db
    .select({
      exerciseId: schema.templateExercises.exerciseId,
      slug: schema.exercises.slug,
      nameRu: schema.exercises.nameRu,
      targetSets: schema.templateExercises.targetSets,
      targetRepsMin: schema.templateExercises.targetRepsMin,
      targetRepsMax: schema.templateExercises.targetRepsMax,
      targetRestSeconds: schema.templateExercises.targetRestSeconds,
      setScheme: schema.templateExercises.setScheme,
      myoMiniSets: schema.templateExercises.myoMiniSets,
      myoRepsPercent: schema.templateExercises.myoRepsPercent,
      myoRestSeconds: schema.templateExercises.myoRestSeconds,
      myoFirstRestSeconds: schema.templateExercises.myoFirstRestSeconds,
      notes: schema.templateExercises.notes,
    })
    .from(schema.templateExercises)
    .innerJoin(
      schema.exercises,
      eq(schema.exercises.id, schema.templateExercises.exerciseId),
    )
    .where(eq(schema.templateExercises.templateId, templateId))
    .orderBy(asc(schema.templateExercises.position));

  const exerciseIds = [...new Set(rows.map((r) => r.exerciseId))];
  const muscleRows = exerciseIds.length
    ? await db
        .select({
          exerciseId: schema.exerciseMuscleGroups.exerciseId,
          muscle: schema.exerciseMuscleGroups.muscleGroupKey,
        })
        .from(schema.exerciseMuscleGroups)
        .where(
          and(
            inArray(schema.exerciseMuscleGroups.exerciseId, exerciseIds),
            eq(schema.exerciseMuscleGroups.role, "primary"),
          ),
        )
    : [];

  const primaryByExercise = new Map<string, string[]>();
  for (const m of muscleRows) {
    const list = primaryByExercise.get(m.exerciseId) ?? [];
    list.push(m.muscle);
    primaryByExercise.set(m.exerciseId, list);
  }

  return {
    name: tpl.name,
    current: rows.map((r) => ({
      slug: r.slug,
      nameRu: r.nameRu,
      primaryMuscles: primaryByExercise.get(r.exerciseId) ?? [],
      targetSets: r.targetSets,
      targetRepsMin: r.targetRepsMin,
      targetRepsMax: r.targetRepsMax,
      targetRestSeconds: r.targetRestSeconds,
      setScheme: r.setScheme,
      myoMiniSets: r.myoMiniSets,
      myoRepsPercent: r.myoRepsPercent,
      myoRestSeconds: r.myoRestSeconds,
      myoFirstRestSeconds: r.myoFirstRestSeconds,
      note: r.notes,
    })),
  };
}

/** Резолвит slug → exerciseId среди видимых атлету упражнений (системные ∪ свои).
 *  Для применения улучшения тренера: возвращённые тренером slug превращаем в id.
 *  При коллизии slug системное упражнение имеет приоритет (детерминизм). R-7:
 *  свои упражнения — строго этого userId. */
export async function resolveExerciseIdsBySlug(
  userId: string,
  slugs: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(slugs)];
  if (unique.length === 0) return new Map();

  const rows = await db
    .select({
      id: schema.exercises.id,
      slug: schema.exercises.slug,
      ownerUserId: schema.exercises.ownerUserId,
    })
    .from(schema.exercises)
    .where(
      and(
        inArray(schema.exercises.slug, unique),
        or(
          isNull(schema.exercises.ownerUserId),
          eq(schema.exercises.ownerUserId, userId),
        ),
      ),
    );

  const map = new Map<string, string>();
  for (const r of rows) {
    // Системное (ownerUserId=null) перекрывает своё при коллизии slug.
    const existing = map.get(r.slug);
    if (!existing || r.ownerUserId === null) map.set(r.slug, r.id);
  }
  return map;
}
