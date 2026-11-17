import { z } from "zod";

import { getUser } from "@/lib/auth/require-user";
import { getActiveWorkoutForUser } from "@/lib/repos/workouts.repo";

import { journalJson as json, serializeJournalWorkout } from "../../response";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return json({ error: "sign_in_required" }, 401);

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return json({ error: "workout_not_found" }, 404);

  const workout = await getActiveWorkoutForUser(user.id, id);
  if (!workout) return json({ error: "workout_not_found" }, 404);
  return json({ workout: { ...serializeJournalWorkout(workout), status: workout.status } });
}
