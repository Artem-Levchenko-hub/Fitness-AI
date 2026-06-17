/** Общий (env-free, R-7) предикат dismissible-строки-совета тренера. Показывать
 *  ли строку с `nextSessionFocus` прошлого разбора, dismiss хранится в
 *  localStorage как id того разбора, что закрыли → новый разбор (новый id)
 *  всплывает снова. Логику держим здесь, чтобы юнит-тестировать без jsdom.
 *
 *  Источник предиката строки-совета на экране старта тренировки по шаблону
 *  ([TemplateFocusHint], H5.7). */
export function shouldShowFocusHint(
  focus: string | null,
  analysisId: string | null,
  dismissedAnalysisId: string | null,
): boolean {
  if (!focus || !focus.trim()) return false;
  if (!analysisId) return false;
  return analysisId !== dismissedAnalysisId;
}
