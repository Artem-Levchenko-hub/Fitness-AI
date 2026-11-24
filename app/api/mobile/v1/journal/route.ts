import { z } from "zod";

import { getUser } from "@/lib/auth/require-user";
import { isUserAdmin } from "@/lib/repos/admin.repo";
import { getUserProfile } from "@/lib/repos/body.repo";
import { listTemplates } from "@/lib/repos/templates.repo";
import { SET_EFFORTS } from "@/lib/domain/workouts/effort";
import {
  getActiveWorkoutForUser,
  getActiveWorkoutId,
  listRecentWorkouts,
  recordSet,
} from "@/lib/repos/workouts.repo";

import { journalJson as json, serializeJournalWorkout } from "./response";

const setSchema = z.object({
  accountId: z.string().min(1).max(128),
  workoutId: z.uuid(),
  workoutExerciseId: z.uuid(),
  clientSetId: z.uuid(),
  completedAt: z.iso.datetime(),
  weightKg: z.number().min(0).max(1000),
  reps: z.number().int().min(1).max(100),
  effort: z.enum(SET_EFFORTS).nullish(),
});

export async function GET() {
  const user = await getUser();
  if (!user) return json({ error: "sign_in_required" }, 401);

  const [workout, recent, isAdmin, templates, profile] = await Promise.all([
    getActiveWorkoutId(user.id, { includeStale: true }).then(
      (id) => id ? getActiveWorkoutForUser(user.id, id) : null,
    ),
    listRecentWorkouts(user.id),
    isUserAdmin(user.id),
    listTemplates(user.id),
    getUserProfile(user.id),
  ]);

  return json({
    accountId: user.id,
    email: user.email,
    displayName: profile?.name,
    weightUnit: profile?.weightUnitPref ?? "kg",
    isAdmin,
    templates: templates.map(({ id, name, exerciseCount }) => ({ id, name, exerciseCount })),
    workout: workout?.status === "active" ? serializeJournalWorkout(workout) : null,
    recent: recent.filter(({ status }) => status === "completed").map(
      ({ id, name, startedAt, setCount }) => ({ id, name, startedAt, setCount }),
    ),
  });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return json({ error: "sign_in_required" }, 401);
  if (request.headers.get("content-type")?.split(";", 1)[0] !== "application/json") {
    return json({ error: "invalid_content_type" }, 415);
  }

  const parsed = setSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_set" }, 400);

  const { accountId, workoutId, completedAt, ...set } = parsed.data;
  if (accountId !== user.id) return json({ error: "account_changed" }, 409);

  const workout = await getActiveWorkoutForUser(user.id, workoutId);
  if (workout?.status === "cancelled" || !workout?.exercises.some(({ id }) => id === set.workoutExerciseId)) {
    return json({ error: "exercise_not_found" }, 404);
  }

  await recordSet(user.id, workoutId, {
    ...set,
    completedAt: new Date(Math.min(Date.parse(completedAt), Date.now())),
  });
  return json({ clientSetId: set.clientSetId });
}
