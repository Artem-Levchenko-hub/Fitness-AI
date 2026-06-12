/**
 * H13.5 — резолв ссылки «блок „Прошлый совет“ в разборе → сам тот прошлый разбор».
 *
 * Когда тренер ссылается на прошлую рекомендацию (поле `pastAdviceFollowUp`,
 * слова владельца «перейти в данную тренировку посмотреть что тогда было»),
 * заголовок секции «Прошлый совет» становится входом в источник — свежайший
 * прошлый AiAnalysis того же формата, тот же ряд, что кормит «# Память тренера»
 * (H5.5). Структурный якорь (workoutId/circuitWorkoutId предшественника), НЕ
 * парсинг прозы LLM — как весь H13.
 *
 * Формат предшественника определяется по заполненным FK:
 *  - silовая: `workoutId` есть → `/workouts/<id>/trainer`;
 *  - круговая: `circuitWorkoutId` есть → `/circuits/<id>`;
 *  - digest/weekly (оба null) → `null` (статичный заголовок, R-37 — некуда вести).
 *
 * Граница (прецедент H6.2b): ссылку резолвит ТОЛЬКО own-view страница (своя
 * сессия). share /a/[token] и разбор друга этот резолвер не вызывают → заголовок
 * статичен (ссылка увела бы смотрящего в чужой прошлый разбор).
 *
 * Чистая (R-7): db/auth не импортит, принимает уже выбранную строку-ref.
 */

/** Ссылка-ref на предшественника: заполненный FK выбранной строки aiAnalyses. */
export type PastAnalysisRef = {
  workoutId: string | null;
  circuitWorkoutId: string | null;
};

/**
 * Путь к прошлому разбору для заголовка секции «Прошлый совет».
 * `null` (статичный заголовок), если:
 *  - предшественника нет (`prev == null` — первый разбор атлета, R-37), либо
 *  - предшественник без workoutId/circuitWorkoutId (digest/weekly — некуда вести).
 * Круговая имеет приоритет: при заполненных обоих FK ведём на /circuits
 * (circuitWorkoutId присутствует только у круговых разборов).
 */
export function resolvePastAdviceHref(
  prev: PastAnalysisRef | null,
): string | null {
  if (!prev) return null;
  if (prev.circuitWorkoutId) return `/circuits/${prev.circuitWorkoutId}`;
  if (prev.workoutId) return `/workouts/${prev.workoutId}/trainer`;
  return null;
}
