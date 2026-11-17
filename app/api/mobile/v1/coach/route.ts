import { z } from "zod";

import { isAiConfigured } from "@/lib/ai/deepseek";
import { renderTrainerMarkdown, trainerSchema } from "@/lib/ai/trainer-parse";
import { videoTechniqueConfig } from "@/lib/ai/video-technique";
import { getUser } from "@/lib/auth/require-user";
import { isUserAdmin } from "@/lib/repos/admin.repo";
import { listCoachMessages } from "@/lib/repos/coach-conversations.repo";
import { hasActiveProSubscription } from "@/lib/repos/subscriptions.repo";
import { getActiveWorkoutForUser, getAiAnalysisForWorkout } from "@/lib/repos/workouts.repo";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return json({ error: "sign_in_required" }, 401);
  const id = z.uuid().safeParse(new URL(request.url).searchParams.get("workoutId"));
  if (!id.success) return json({ error: "workout_not_found" }, 404);
  const workout = await getActiveWorkoutForUser(user.id, id.data);
  if (workout?.status !== "completed") return json({ error: "workout_not_found" }, 404);

  const [analysis, messages, videoAvailable] = await Promise.all([
    getAiAnalysisForWorkout(user.id, workout.id),
    listCoachMessages(user.id, workout.id, 60),
    videoTechniqueConfig() && workout.exercises.length > 0
      ? isUserAdmin(user.id).then((isAdmin) => isAdmin || hasActiveProSubscription(user.id))
      : false,
  ]);
  const structured = trainerSchema.safeParse(analysis?.resultJson);
  return json({
    coachAvailable: isAiConfigured(),
    videoAvailable,
    analysis: structured.success ? renderTrainerMarkdown(structured.data) : analysis?.content ?? null,
    messages,
  });
}
