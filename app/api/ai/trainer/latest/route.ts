import { requireUser } from "@/lib/auth/require-user";
import { getLatestTrainerResult } from "@/lib/repos/workouts.repo";

export const runtime = "nodejs";

/** GET /api/ai/trainer/latest?workoutId= — последний сохранённый structured
 *  разбор тренировки. Stream-консьюмер (F8) дёргает его ПОСЛЕ завершения стрима,
 *  чтобы показать TrainerResultCard (та же Zod-валидация на сервере при сохранении).
 *  resultJson===null → разбор ещё не сохранён или legacy markdown-only. */
export async function GET(request: Request) {
  const user = await requireUser();
  const workoutId = new URL(request.url).searchParams.get("workoutId");
  if (!workoutId) {
    return Response.json({ error: "workoutId_required" }, { status: 400 });
  }

  const analysis = await getLatestTrainerResult(user.id, workoutId);

  return Response.json({
    analysis: analysis
      ? {
          id: analysis.id,
          resultJson: analysis.resultJson,
          modelVersion: analysis.modelVersion,
          createdAt: analysis.createdAt,
        }
      : null,
  });
}
