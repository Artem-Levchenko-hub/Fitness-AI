import { requireUser } from "@/lib/auth/require-user";
import { buildInsightQuery } from "@/lib/ai/insight-query";
import { retrieveRelevant } from "@/lib/ai/rag/retrieve";
import { loadWorkoutInsightInputs } from "@/lib/repos/workouts.repo";

export const runtime = "nodejs";

// Короткий EN-запрос против книжного корпуса даёт более низкий similarity, чем
// богатый промпт разбора (trainer-stream шлёт ~1200 символов) → явно занижаем
// порог относительно дефолтного 0.35, чтобы карточки фактов не умирали тихо.
// domains:["training"] страхует от разбавления будущими книгами про сон/питание.
const INSIGHT_TOP_K = 5;
const INSIGHT_MIN_SIMILARITY = 0.3;

/** GET /api/ai/trainer/insights?workoutId= — «книжные факты под сессию» для
 *  карточек в момент ожидания разбора (H16.1). R-7: владелец тренировки
 *  гейтится в repo по userId — чужой/несуществующий workoutId → пустые
 *  карточки, не утечка. Fail-soft (R-10): RAG упал / нет релевантных кусков →
 *  `{ chunks: [] }`, НЕ 500 (лоадер всё равно живёт — H16.2). */
export async function GET(request: Request) {
  const user = await requireUser();

  const workoutId = new URL(request.url).searchParams.get("workoutId");
  if (!workoutId) {
    return Response.json({ error: "workoutId_required" }, { status: 400 });
  }

  const inputs = await loadWorkoutInsightInputs(user.id, workoutId);
  if (!inputs) {
    // Не владелец / нет тренировки — пустые карточки (R-7 не утечка, R-37).
    return Response.json({ chunks: [] });
  }

  const query = buildInsightQuery(inputs);

  let chunks;
  try {
    chunks = await retrieveRelevant(query, {
      topK: INSIGHT_TOP_K,
      minSimilarity: INSIGHT_MIN_SIMILARITY,
      domains: ["training"],
    });
  } catch (e) {
    console.error("[trainer-insights] RAG retrieve failed:", e);
    return Response.json({ chunks: [] });
  }

  // Лог запаса к порогу — видно, проходят ли короткие EN-запросы minSimilarity.
  console.info(
    `[trainer-insights] workout=${workoutId} q="${query}" chunks=${chunks.length}` +
      (chunks.length > 0
        ? ` sims=[${chunks.map((c) => c.similarity.toFixed(2)).join(", ")}]`
        : ""),
  );

  return Response.json({
    chunks: chunks.map((c) => ({
      content: c.content,
      sourceTitle: c.sourceTitle,
      sourceAuthor: c.sourceAuthor,
      page: c.page,
      similarity: c.similarity,
    })),
  });
}
