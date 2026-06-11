/** Старт ISO-недели (понедельник) и сдвиг даты — в timezone юзера, без
 *  зависимости от серверной TZ и без DST-краёв.
 *
 *  Зачем: история `/workouts` группируется по неделям. Раньше границы недели
 *  считались в СЕРВЕРНОЙ TZ (`getDay`/`getDate`) → для юзера вне TZ сервера
 *  тренировка у границы воскресенье↔понедельник падала не в ту неделю. Здесь
 *  всё считается в TZ юзера через `localDateIso` (R-04: единый источник
 *  локального дня), якорь — полдень UTC (DST-safe), доступ через `getUTC*`. */

import { localDateIso } from "./local-day";

/** Понедельник ISO-недели, содержащей `now`, как "YYYY-MM-DD" в timezone `tz`. */
export function isoWeekStartIso(now: Date, tz: string): string {
  const [y, m, d] = localDateIso(now, tz).split("-").map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dow = anchor.getUTCDay(); // 0=Вс .. 6=Сб
  const diff = dow === 0 ? -6 : 1 - dow; // сдвиг до понедельника
  anchor.setUTCDate(anchor.getUTCDate() + diff);
  return anchor.toISOString().slice(0, 10);
}

/** Сдвиг "YYYY-MM-DD" на `n` дней (через полдень UTC, без DST-краёв). */
export function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  anchor.setUTCDate(anchor.getUTCDate() + n);
  return anchor.toISOString().slice(0, 10);
}
