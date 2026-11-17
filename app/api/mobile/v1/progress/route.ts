import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { BodyMeasurement, NutritionEntry, SleepLog } from "@/db/schema";
import { getUser } from "@/lib/auth/require-user";
import { addDaysIso } from "@/lib/datetime/iso-week";
import { localDateIso } from "@/lib/datetime/local-day";
import { addMeasurement, getUserProfile, listMeasurements } from "@/lib/repos/body.repo";
import { getNutritionForDate, listRecentNutrition, upsertNutrition } from "@/lib/repos/nutrition.repo";
import { getSleepForDate, listRecentSleep, upsertSleep } from "@/lib/repos/sleep.repo";
import { dailyVolume, workoutFrequency } from "@/lib/repos/stats.repo";
import { bodyMeasurementSchema } from "@/server/schemas/body";
import { nutritionEntrySchema, sleepLogSchema } from "@/server/schemas/wellness";

const defaultTimezone = "Europe/Moscow";

const mutation = z.object({
  accountId: z.string().min(1).max(128),
  kind: z.enum(["measurement", "sleep", "nutrition"]),
  date: z.iso.date().refine((value) => !value.startsWith("0000-")),
  clientEntryId: z.uuid().optional(),
  values: z.object({ notes: z.string().max(500).optional() }).catchall(z.number()),
});

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

function measurementEntry(row: BodyMeasurement) {
  const {
    id, measuredAt, weightKg, bodyFatPct, waistCm, neckCm, chestCm, hipCm, armCm, thighCm, notes,
  } = row;
  return {
    id, date: measuredAt.toISOString().slice(0, 10),
    weightKg, bodyFatPct, waistCm, neckCm, chestCm, hipCm, armCm, thighCm, notes,
  };
}

function sleepEntry({ date, hours, quality, notes }: SleepLog) {
  return { date, hours, quality, notes };
}

function nutritionEntry({ date, kcal, proteinG, fatG, carbsG, notes }: NutritionEntry) {
  return { date, kcal, proteinG, fatG, carbsG, notes };
}

function profileTimezone(timezone: string | null | undefined) {
  const candidate = timezone?.trim() || defaultTimezone;
  try {
    new Intl.DateTimeFormat("ru", { timeZone: candidate });
    return candidate;
  } catch {
    return defaultTimezone;
  }
}

export async function GET() {
  const user = await getUser();
  if (!user) return json({ error: "sign_in_required" }, 401);

  const profile = await getUserProfile(user.id);
  const timezone = profileTimezone(profile?.timezone);
  const today = localDateIso(new Date(), timezone);
  const [volume, frequency, measurements, sleepToday, nutritionToday, sleep, nutrition] =
    await Promise.all([
      dailyVolume(user.id, "30d", timezone),
      workoutFrequency(user.id, "30d", timezone),
      listMeasurements(user.id, 30),
      getSleepForDate(user.id, today),
      getNutritionForDate(user.id, today),
      listRecentSleep(user.id, 14),
      listRecentNutrition(user.id, 14),
    ]);

  const volumeByDate = new Map(volume.map((point) => [point.date, point]));
  const countByDate = new Map(frequency.map(({ date, count }) => [date, count]));
  const training = Array.from({ length: 30 }, (_, index) => {
    const date = addDaysIso(today, index - 29);
    const point = volumeByDate.get(date);
    return {
      date,
      volumeKg: point?.volume ?? 0,
      sets: point?.sets ?? 0,
      reps: point?.reps ?? 0,
      count: countByDate.get(date) ?? 0,
    };
  });

  return json({
    accountId: user.id,
    today,
    training,
    measurements: measurements.map(measurementEntry),
    sleepToday: sleepToday && sleepEntry(sleepToday),
    nutritionToday: nutritionToday && nutritionEntry(nutritionToday),
    sleep: sleep.map(sleepEntry),
    nutrition: nutrition.map(nutritionEntry),
  });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return json({ error: "sign_in_required" }, 401);
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") return json({ error: "invalid_content_type" }, 415);

  const parsed = mutation.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_entry" }, 400);

  const { accountId, kind, date, clientEntryId, values } = parsed.data;
  if (accountId !== user.id) return json({ error: "account_changed" }, 409);

  switch (kind) {
    case "measurement": {
      const entry = bodyMeasurementSchema.safeParse({ ...values, measuredAt: date });
      if (!clientEntryId || !entry.success) return json({ error: "invalid_measurement" }, 400);
      const saved = await addMeasurement(user.id, entry.data, clientEntryId);
      revalidatePath("/body");
      revalidatePath("/stats");
      revalidatePath("/dashboard");
      return json({ kind, entry: measurementEntry(saved) });
    }
    case "sleep": {
      const entry = sleepLogSchema.safeParse({ ...values, date });
      if (!entry.success) return json({ error: "invalid_sleep" }, 400);
      const saved = await upsertSleep(user.id, entry.data);
      revalidatePath("/sleep");
      revalidatePath("/dashboard");
      return json({ kind, entry: sleepEntry(saved) });
    }
    case "nutrition": {
      const entry = nutritionEntrySchema.safeParse({ ...values, date });
      if (!entry.success) return json({ error: "invalid_nutrition" }, 400);
      const saved = await upsertNutrition(user.id, entry.data);
      revalidatePath("/nutrition");
      revalidatePath("/dashboard");
      return json({ kind, entry: nutritionEntry(saved) });
    }
  }
}
