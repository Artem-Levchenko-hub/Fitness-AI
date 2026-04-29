import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";

export type NewMeasurementInput = {
  measuredAt?: Date;
  weightKg?: number | null;
  bodyFatPct?: number | null;
  waistCm?: number | null;
  neckCm?: number | null;
  chestCm?: number | null;
  hipCm?: number | null;
  armCm?: number | null;
  thighCm?: number | null;
  notes?: string | null;
};

export async function listMeasurements(
  userId: string,
  limit = 60,
): Promise<schema.BodyMeasurement[]> {
  return db
    .select()
    .from(schema.bodyMeasurements)
    .where(eq(schema.bodyMeasurements.userId, userId))
    .orderBy(desc(schema.bodyMeasurements.measuredAt))
    .limit(limit);
}

export async function getLatestMeasurement(
  userId: string,
): Promise<schema.BodyMeasurement | null> {
  const [row] = await db
    .select()
    .from(schema.bodyMeasurements)
    .where(eq(schema.bodyMeasurements.userId, userId))
    .orderBy(desc(schema.bodyMeasurements.measuredAt))
    .limit(1);
  return row ?? null;
}

export async function addMeasurement(
  userId: string,
  input: NewMeasurementInput,
): Promise<{ id: string }> {
  const [row] = await db
    .insert(schema.bodyMeasurements)
    .values({
      userId,
      measuredAt: input.measuredAt ?? new Date(),
      weightKg: input.weightKg ?? null,
      bodyFatPct: input.bodyFatPct ?? null,
      waistCm: input.waistCm ?? null,
      neckCm: input.neckCm ?? null,
      chestCm: input.chestCm ?? null,
      hipCm: input.hipCm ?? null,
      armCm: input.armCm ?? null,
      thighCm: input.thighCm ?? null,
      notes: input.notes ?? null,
    })
    .returning({ id: schema.bodyMeasurements.id });
  return { id: row!.id };
}

export async function deleteMeasurement(
  userId: string,
  id: string,
): Promise<void> {
  await db
    .delete(schema.bodyMeasurements)
    .where(
      and(
        eq(schema.bodyMeasurements.id, id),
        eq(schema.bodyMeasurements.userId, userId),
      ),
    );
}

export type UserProfileUpdate = {
  birthDate?: Date | null;
  heightCm?: number | null;
  sex?: string | null;
  weightUnitPref?: "kg" | "lb";
  experience?: "beginner" | "intermediate" | "advanced";
  timezone?: string;
};

export async function updateUserProfile(
  userId: string,
  patch: UserProfileUpdate,
): Promise<void> {
  // Drizzle требует не-undefined keys; собираем только изменённые
  const set: Record<string, unknown> = {};
  if (patch.birthDate !== undefined)
    set.birthDate = patch.birthDate
      ? patch.birthDate.toISOString().slice(0, 10)
      : null;
  if (patch.heightCm !== undefined) set.heightCm = patch.heightCm;
  if (patch.sex !== undefined) set.sex = patch.sex;
  if (patch.weightUnitPref !== undefined)
    set.weightUnitPref = patch.weightUnitPref;
  if (patch.experience !== undefined) set.experience = patch.experience;
  if (patch.timezone !== undefined) set.timezone = patch.timezone;

  if (Object.keys(set).length === 0) return;

  await db
    .update(schema.users)
    .set(set)
    .where(eq(schema.users.id, userId));
}

export async function getUserProfile(userId: string) {
  const [row] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      birthDate: schema.users.birthDate,
      heightCm: schema.users.heightCm,
      sex: schema.users.sex,
      weightUnitPref: schema.users.weightUnitPref,
      experience: schema.users.experience,
      timezone: schema.users.timezone,
      locale: schema.users.locale,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return row ?? null;
}
