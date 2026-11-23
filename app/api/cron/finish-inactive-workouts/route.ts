import { AUTO_FINISH_IDLE_MS } from "@/lib/domain/workouts/active-session";
import { listInactiveStrengthWorkouts } from "@/lib/repos/workouts.repo";
import { finishStrengthWorkout } from "@/server/finish-strength-workout";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret ? request.headers.get("authorization") !== `Bearer ${secret}` : process.env.NODE_ENV === "production") {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const inactiveBefore = new Date(Date.now() - AUTO_FINISH_IDLE_MS);
  const candidates = await listInactiveStrengthWorkouts(inactiveBefore);
  let completed = 0;
  let failed = 0;
  for (const workout of candidates) {
    try {
      // Общий finish повторно читает план и подходы под блокировкой строки:
      // новый подход между поиском кандидата и этой точкой откладывает финиш.
      const result = await finishStrengthWorkout(workout.userId, workout.id, undefined, { inactiveBefore });
      if (result === "changed") completed += 1;
    } catch (error) {
      failed += 1;
      console.error("[finish-inactive-workouts] failed", workout.id, error);
    }
  }
  return Response.json({ checked: candidates.length, completed, failed });
}

export async function GET(request: Request) {
  return POST(request);
}
