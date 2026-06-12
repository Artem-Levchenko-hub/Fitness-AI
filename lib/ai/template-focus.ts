/** H5.7 «Замкнуть петлю совет→сессия»: чистый (env-free, R-7) предикат —
 *  показывать ли на экране старта тренировки по шаблону строку-совет из
 *  ПОСЛЕДНЕГО AI-разбора предыдущей тренировки этого шаблона. Dismiss хранится
 *  в localStorage как id того разбора, что закрыли; новый разбор (новый id)
 *  всплывает снова. Логику держим здесь, чтобы юнит-тестировать без jsdom. */
export function shouldShowFocusHint(
  focus: string | null,
  analysisId: string | null,
  dismissedAnalysisId: string | null,
): boolean {
  if (!focus || !focus.trim()) return false;
  if (!analysisId) return false;
  return analysisId !== dismissedAnalysisId;
}
