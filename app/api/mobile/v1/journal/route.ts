import { z } from "zod";

import { getUser } from "@/lib/auth/require-user";
import {
  getActiveWorkoutForUser,
  getActiveWorkoutId,
  listRecentWorkouts,
  recordSet,
} from "@/lib/repos/workouts.repo";

const setSchema = z.object({
  accountId: z.string().min(1).max(128),
  workoutId: z.uuid(),
  workoutExerciseId: z.uuid(),
  clientSetId: z.uuid(),
  completedAt: z.iso.datetime(),
  weightKg: z.number().min(0).max(1000),
  reps: z.number().int().min(1).max(100),
});

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  const user = await getUser();
  if (!user) return json({ error: "sign_in_required" }, 401);

  const [workoutId, recent] = await Promise.all([
    getActiveWorkoutId(user.id, { includeStale: true }),
    listRecentWorkouts(user.id),
  ]);
  const workout = workoutId ? await getActiveWorkoutForUser(user.id, workoutId) : null;

  return json({
    accountId: user.id,
    email: user.email,
    workout: workout?.status === "active" ? {
      id: workout.id,
      name: workout.name,
      exercises: workout.exercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.exerciseNameRu,
        sets: exercise.sets.map(({ id, clientSetId, setIndex, weightKg, reps }) => ({
          id, clientSetId, setIndex, weightKg, reps,
        })),
      })),
    } : null,
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
