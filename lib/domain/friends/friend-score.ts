/** Оценка ИИ-тренера по тренировке для показа другу (фича «делиться»). Чистая
 *  доменная логика (R-7): на вход — сохранённый resultJson разбора, на выход —
 *  целая оценка 0..100 либо null. */

/** Безопасно достаёт overallScore из resultJson разбора. resultJson — jsonb
 *  (unknown; у legacy markdown-only разборов = null). Возвращает целое 0..100
 *  либо null, если поля нет / оно не число / вне диапазона. Округляем — модель
 *  обязана давать целое, но дробь не должна ломать бейдж. */
export function extractOverallScore(resultJson: unknown): number | null {
  if (resultJson == null || typeof resultJson !== "object") return null;
  const raw = (resultJson as Record<string, unknown>).overallScore;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  const score = Math.round(raw);
  if (score < 0 || score > 100) return null;
  return score;
}
