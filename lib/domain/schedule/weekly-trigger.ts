/** Триггер авто-разбора недели (H8.2b).
 *
 *  Чистая логика (R-7): когда по локальному времени атлета пора ставить
 *  `weekly_review` job «по закрытии ISO-недели». Никаких db/env — только
 *  tz-математика через Intl. Юнит-тестируемо.
 *
 *  ОКНО: вечер воскресенья (последний день ISO-недели Пн–Вс). Стреляем, пока
 *  `now` ещё ВНУТРИ закрывающейся недели, чтобы воркер `generateWeeklyReview`
 *  посчитал её как «эту неделю» (current). Если бы стреляли в понедельник,
 *  неделя бы уже перекатилась и «эта неделя» оказалась пустой. */

/** Локальный час воскресенья, когда ставим недельный разбор (как daily_digest
 *  в 22:00 — но недельный раньше, 20:00, чтобы захватить почти весь день Вс). */
export const WEEKLY_REVIEW_HOUR = 20;

/** Минимум завершённых силовых сессий в неделе, иначе разбирать нечего
 *  (gate H8.2). Совпадает с `hasWeeklyData`-духом, но строже: ≥2, не ≥1. */
export const MIN_WEEKLY_SESSIONS = 2;

/** Окно постановки недельного разбора: воскресенье И локальный час
 *  == WEEKLY_REVIEW_HOUR в таймзоне атлета. Cron-роут тикает ежечасно и
 *  идемпотентен (дедуп по уже стоящему job-у), так что попадание в этот
 *  единственный час за неделю ставит ровно один разбор. */
export function isWeeklyReviewWindow(now: Date, tz: string): boolean {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      hour: "numeric",
      hour12: false,
      timeZone: tz,
    }).formatToParts(now);
    const weekday = parts.find((p) => p.type === "weekday")?.value;
    const hour =
      parseInt(parts.find((p) => p.type === "hour")?.value ?? "-1", 10) % 24;
    return weekday === "Sun" && hour === WEEKLY_REVIEW_HOUR;
  } catch {
    // Невалидная tz → не стреляем (fail-soft, R-10): лучше пропустить разбор,
    // чем поставить его в случайный момент.
    return false;
  }
}
