import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { slugify } from "@/lib/utils/slugify";

type MuscleKey = (typeof schema.muscleGroupKey.enumValues)[number];
type MuscleRole = (typeof schema.muscleRole.enumValues)[number];

export type ExerciseListItem = {
  id: string;
  slug: string;
  nameRu: string;
  nameEn: string;
  description: string | null;
  isCustom: boolean;
  ownerUserId: string | null;
  primaryMuscles: MuscleKey[];
  secondaryMuscles: MuscleKey[];
};

export type ExerciseFilter = {
  search?: string;
  muscleKey?: MuscleKey;
  scope?: "all" | "system" | "custom";
};

/** Список упражнений: system (ownerUserId IS NULL) + custom для userId.
 *  Все доступы фильтруются здесь — это data access layer (R-7). */
export async function listExercises(
  userId: string,
  filter: ExerciseFilter = {},
): Promise<ExerciseListItem[]> {
  const ownerWhere =
    filter.scope === "system"
      ? isNull(schema.exercises.ownerUserId)
      : filter.scope === "custom"
        ? eq(schema.exercises.ownerUserId, userId)
        : or(
            isNull(schema.exercises.ownerUserId),
            eq(schema.exercises.ownerUserId, userId),
          );

  const searchWhere = filter.search
    ? sql`(${schema.exercises.nameRu} ILIKE ${`%${filter.search}%`}
           OR ${schema.exercises.nameEn} ILIKE ${`%${filter.search}%`})`
    : undefined;

  const rows = await db
    .select({
      id: schema.exercises.id,
      slug: schema.exercises.slug,
      nameRu: schema.exercises.nameRu,
      nameEn: schema.exercises.nameEn,
      description: schema.exercises.description,
      isCustom: schema.exercises.isCustom,
      ownerUserId: schema.exercises.ownerUserId,
    })
    .from(schema.exercises)
    .where(and(ownerWhere, searchWhere))
    .orderBy(asc(schema.exercises.nameRu));

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const bindings = await db
    .select({
      exerciseId: schema.exerciseMuscleGroups.exerciseId,
      muscleGroupKey: schema.exerciseMuscleGroups.muscleGroupKey,
      role: schema.exerciseMuscleGroups.role,
    })
    .from(schema.exerciseMuscleGroups)
    .where(inArray(schema.exerciseMuscleGroups.exerciseId, ids));

  const map = new Map<string, { primary: MuscleKey[]; secondary: MuscleKey[] }>();
  for (const b of bindings) {
    const e = map.get(b.exerciseId) ?? { primary: [], secondary: [] };
    if (b.role === "primary") e.primary.push(b.muscleGroupKey);
    else e.secondary.push(b.muscleGroupKey);
    map.set(b.exerciseId, e);
  }

  let items: ExerciseListItem[] = rows.map((r) => ({
    ...r,
    primaryMuscles: map.get(r.id)?.primary ?? [],
    secondaryMuscles: map.get(r.id)?.secondary ?? [],
  }));

  if (filter.muscleKey) {
    const key = filter.muscleKey;
    items = items.filter(
      (it) =>
        it.primaryMuscles.includes(key) || it.secondaryMuscles.includes(key),
    );
  }

  return items;
}

export async function getExerciseById(
  userId: string,
  exerciseId: string,
): Promise<ExerciseListItem | null> {
  const items = await listExercises(userId);
  return items.find((it) => it.id === exerciseId) ?? null;
}

export type ExerciseInput = {
  nameRu: string;
  nameEn: string;
  description?: string | null;
  primary: MuscleKey[];
  secondary?: MuscleKey[];
};

export async function createCustomExercise(
  userId: string,
  data: ExerciseInput,
): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const id = crypto.randomUUID();
    const baseSlug = slugify(data.nameEn || data.nameRu) || "exercise";
    const slug = `${baseSlug}-${id.slice(0, 8)}`;

    await tx.insert(schema.exercises).values({
      id,
      slug,
      nameRu: data.nameRu,
      nameEn: data.nameEn,
      description: data.description ?? null,
      isCustom: true,
      ownerUserId: userId,
    });

    const bindings = buildMuscleBindings(id, data);
    if (bindings.length > 0) {
      await tx.insert(schema.exerciseMuscleGroups).values(bindings);
    }

    return { id };
  });
}

export async function updateCustomExercise(
  userId: string,
  exerciseId: string,
  data: ExerciseInput,
): Promise<void> {
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: schema.exercises.id })
      .from(schema.exercises)
      .where(
        and(
          eq(schema.exercises.id, exerciseId),
          eq(schema.exercises.ownerUserId, userId),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      throw new Error("Exercise not found or not yours");
    }

    await tx
      .update(schema.exercises)
      .set({
        nameRu: data.nameRu,
        nameEn: data.nameEn,
        description: data.description ?? null,
      })
      .where(eq(schema.exercises.id, exerciseId));

    await tx
      .delete(schema.exerciseMuscleGroups)
      .where(eq(schema.exerciseMuscleGroups.exerciseId, exerciseId));

    const bindings = buildMuscleBindings(exerciseId, data);
    if (bindings.length > 0) {
      await tx.insert(schema.exerciseMuscleGroups).values(bindings);
    }
  });
}

export async function deleteCustomExercise(
  userId: string,
  exerciseId: string,
): Promise<void> {
  await db
    .delete(schema.exercises)
    .where(
      and(
        eq(schema.exercises.id, exerciseId),
        eq(schema.exercises.ownerUserId, userId),
        eq(schema.exercises.isCustom, true),
      ),
    );
}

function buildMuscleBindings(
  exerciseId: string,
  data: ExerciseInput,
): Array<{
  exerciseId: string;
  muscleGroupKey: MuscleKey;
  role: MuscleRole;
}> {
  return [
    ...data.primary.map((key) => ({
      exerciseId,
      muscleGroupKey: key,
      role: "primary" as const,
    })),
    ...(data.secondary ?? []).map((key) => ({
      exerciseId,
      muscleGroupKey: key,
      role: "secondary" as const,
    })),
  ];
}

export async function listMuscleGroups() {
  return db
    .select()
    .from(schema.muscleGroups)
    .orderBy(asc(schema.muscleGroups.nameRu));
}
