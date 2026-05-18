import { and, between, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import type { NewNutritionEntry, NutritionEntry } from "@/db/schema";

export async function getNutritionForDate(
  userId: string,
  isoDate: string,
): Promise<NutritionEntry | null> {
  const [row] = await db
    .select()
    .from(schema.nutritionEntries)
    .where(
      and(
        eq(schema.nutritionEntries.userId, userId),
        eq(schema.nutritionEntries.date, isoDate),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listRecentNutrition(
  userId: string,
  limit = 14,
): Promise<NutritionEntry[]> {
  return db
    .select()
    .from(schema.nutritionEntries)
    .where(eq(schema.nutritionEntries.userId, userId))
    .orderBy(desc(schema.nutritionEntries.date))
    .limit(limit);
}

export async function getNutritionRange(
  userId: string,
  fromIso: string,
  toIso: string,
): Promise<NutritionEntry[]> {
  return db
    .select()
    .from(schema.nutritionEntries)
    .where(
      and(
        eq(schema.nutritionEntries.userId, userId),
        between(schema.nutritionEntries.date, fromIso, toIso),
      ),
    )
    .orderBy(desc(schema.nutritionEntries.date));
}

export async function upsertNutrition(
  userId: string,
  input: Omit<NewNutritionEntry, "userId" | "id"> & { id?: string },
): Promise<NutritionEntry> {
  const [row] = await db
    .insert(schema.nutritionEntries)
    .values({ ...input, userId })
    .onConflictDoUpdate({
      target: [schema.nutritionEntries.userId, schema.nutritionEntries.date],
      set: {
        kcal: input.kcal ?? null,
        proteinG: input.proteinG ?? null,
        fatG: input.fatG ?? null,
        carbsG: input.carbsG ?? null,
        notes: input.notes ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!row) throw new Error("upsertNutrition вернул пустой результат");
  return row;
}

export async function deleteNutritionForDate(
  userId: string,
  isoDate: string,
): Promise<void> {
  await db
    .delete(schema.nutritionEntries)
    .where(
      and(
        eq(schema.nutritionEntries.userId, userId),
        eq(schema.nutritionEntries.date, isoDate),
      ),
    );
}
