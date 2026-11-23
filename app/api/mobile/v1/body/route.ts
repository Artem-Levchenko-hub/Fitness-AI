import { buildAvatarData, hasTrainingData } from "@/components/avatar/build-avatar-data";
import { getUser } from "@/lib/auth/require-user";
import { getLatestMeasurement, getUserProfile } from "@/lib/repos/body.repo";
import { getMuscleGroupGoals } from "@/lib/repos/goals.repo";
import {
  muscleGroupRecords, muscleHeatProfile, muscleLastTrained, muscleWeeklyVolume,
} from "@/lib/repos/stats.repo";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET() {
  const user = await getUser();
  if (!user) return json({ error: "sign_in_required" }, 401);

  const now = new Date();
  const profile = await getUserProfile(user.id);
  let timezone = profile?.timezone?.trim() || "Europe/Moscow";
  try { new Intl.DateTimeFormat("ru", { timeZone: timezone }); }
  catch { timezone = "Europe/Moscow"; }

  // These are the same sources, period and builder as the account's web profile.
  const [heat, records, lastTrained, weeklyVolume, measurement, goals] = await Promise.all([
    muscleHeatProfile(user.id, now),
    muscleGroupRecords(user.id),
    muscleLastTrained(user.id),
    muscleWeeklyVolume(user.id, now, timezone, 6),
    getLatestMeasurement(user.id),
    getMuscleGroupGoals(user.id),
  ]);
  const goalTargets = new Map([...goals].map(([key, goal]) => [key, goal.targetValue]));

  return json({
    accountId: user.id,
    timezone,
    hasTrainingData: hasTrainingData(heat),
    heightCm: profile?.heightCm ?? null,
    weightKg: measurement?.weightKg ?? null,
    muscles: buildAvatarData(heat, now, records, lastTrained, weeklyVolume, goalTargets),
  });
}
