/** Локальная дата/день-недели юзера по его timezone — без зависимости от
 *  серверной TZ и без DST-краёв.
 *
 *  ЕДИНСТВЕННЫЙ источник (R-04, DRY про знание): и подсветка «сегодня» на
 *  дашборде, и cron `app/api/cron/push-reminders/route.ts` импортируют
 *  `localDateIso` / `localIsoDay` отсюда. Inline-копии в cron больше нет. */

/** Локальная дата юзера как "YYYY-MM-DD" в его timezone. */
export function localDateIso(now: Date, tz: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("sv-SE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: tz,
    });
    return fmt.format(now); // "YYYY-MM-DD"
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** ISO-день недели юзера по его timezone: 1=Пн .. 7=Вс.
 *  Берём локальную дату и считаем день недели через UTC-полдень — без
 *  DST-краёв и без зависимости от локали. */
export function localIsoDay(now: Date, tz: string): number {
  const d = new Date(`${localDateIso(now, tz)}T12:00:00Z`);
  const dow = d.getUTCDay(); // 0=Вс .. 6=Сб
  return dow === 0 ? 7 : dow;
}
