/** Политика «брошенной активной сессии» (H2.2b).
 *
 *  Сессия INSERT-ится `status='active'` в момент старта и снимается только
 *  явным finish/cancel или стартом новой сессии того же формата. Брошенная
 *  сессия (старт → ушёл без «Завершить») иначе висела бы `active` вечно и
 *  показывалась resume-баннером «фантомом» на /dashboard и /workouts.
 *
 *  Решение (минимальный диф, БЕЗ потери данных): на ЧТЕНИИ не показываем как
 *  resume сессию старше окна. Строка остаётся `active` в БД — её подходы
 *  по-прежнему доступны по прямому URL (столп 4 NORTH STAR), просто перестаёт
 *  всплывать баннером. Реальная тренировка не длится >12 ч, поэтому окно
 *  отсекает только заброшенное (через ночь), не легитимную сессию. */
export const RESUME_MAX_AGE_HOURS = 12;

const RESUME_MAX_AGE_MS = RESUME_MAX_AGE_HOURS * 60 * 60 * 1000;

/** Граница окна: сессии со `startedAt` РАНЬШЕ неё считаются брошенными и не
 *  показываются как resume. Не мутирует `now`. */
export function resumeCutoff(now: Date): Date {
  return new Date(now.getTime() - RESUME_MAX_AGE_MS);
}

/** JS-зеркало SQL-фильтра `gte(startedAt, resumeCutoff(now))` — для юнит-теста
 *  политики без обращения к БД. Граница включительна (gte): сессия ровно на
 *  границе ещё резюмируется. */
export function isResumable(startedAt: Date, now: Date): boolean {
  return startedAt.getTime() >= resumeCutoff(now).getTime();
}
