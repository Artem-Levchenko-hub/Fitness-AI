import {
  summarizeGoalProgress,
  type GoalProgressView,
} from "./goal-projection";

/** H18.2 — единый источник правила «как мерить прогресс к цели ЧАСТОТЫ группы
 *  мышц». Частота измеряется текущим скользящим окном: число working-подходов
 *  за последние 7 дней (datum.sets аватара) против цели «подходов/нед».
 *
 *  Серия из одной точки [weeklySets] — намеренно: по одному снимку темпа нет,
 *  поэтому ETA не выдумывается (projectProgress вернёт pace undefined → eta
 *  null). Это честно (R-10): «ты сейчас X из Y», без ложной экстраполяции.
 *  Чистая функция (R-7) — без db/next/ui, тот же контракт GoalProgressView,
 *  что трек-бар цели упражнения (один носитель — GoalTrackBar, урок H4.3). */
export function frequencyGoalView(
  weeklySets: number,
  target: number,
): GoalProgressView {
  return summarizeGoalProgress([weeklySets], target);
}
