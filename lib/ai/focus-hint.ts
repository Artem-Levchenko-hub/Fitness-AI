/** Общий (env-free, R-7) предикат dismissible-строки-совета тренера. Показывать
 *  ли строку с `nextSessionFocus` прошлого разбора, dismiss хранится в
 *  localStorage как id того разбора, что закрыли → новый разбор (новый id)
 *  всплывает снова. Логику держим здесь, чтобы юнит-тестировать без jsdom.
 *
 *  Переиспользуется на ДВУХ поверхностях (R-04, не копипаст):
 *   - H5.7 экран старта тренировки по шаблону ([TemplateFocusHint]);
 *   - H11.2 голос тренера на /dashboard ([TrainerVoiceBanner]). */
export function shouldShowFocusHint(
  focus: string | null,
  analysisId: string | null,
  dismissedAnalysisId: string | null,
): boolean {
  if (!focus || !focus.trim()) return false;
  if (!analysisId) return false;
  return analysisId !== dismissedAnalysisId;
}
