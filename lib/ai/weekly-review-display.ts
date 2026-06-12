import { trainerSchema, type TrainerResponse } from "@/lib/ai/trainer-parse";

/** H8.2c — безопасный разбор сохранённого weekly_review для показа на /stats.
 *  Воркер H8.2 пишет TrainerResponse в ai_analyses.resultJson; здесь валидируем
 *  его перед рендером в TrainerResultCard. Fail-soft (R-10): legacy/битый JSON →
 *  null, экран /stats не падает (трактуется как «авто-разбора пока нет»).
 *  optional-поля H5.4+ не обязательны — safeParse их не валит. */
export function parseWeeklyReviewResult(
  resultJson: unknown,
): TrainerResponse | null {
  const parsed = trainerSchema.safeParse(resultJson);
  return parsed.success ? parsed.data : null;
}
