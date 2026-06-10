/** Sanity-guard на невозможный прогресс силы (G5).
 *  Pure functions — никаких импортов из БД/Auth/UI (R-7).
 *
 *  Реальный недельный прирост силы измеряется единицами процентов даже у
 *  новичков. Скачок оценочного 1RM выше ~20% при заметной абсолютной дельте
 *  почти всегда означает ошибку ввода (вес записан не к тому упражнению,
 *  опечатка), а не настоящий рекорд. Мы НЕ блокируем сохранение — только
 *  помечаем скачок как подозрительный, чтобы статистика и AI-разбор не врали
 *  и не хвалили атлета за нереальный прогресс. */

/** Доля прироста e1RM, выше которой скачок считается подозрительным. */
export const SUSPICIOUS_JUMP_PCT = 0.2;

/** Минимальная абсолютная дельта (кг), ниже которой относительный скачок
 *  не флагуем — на лёгких упражнениях большой % безобиден (5→8 кг = 60%,
 *  но это нормальная разминочная прогрессия новичка). */
export const SUSPICIOUS_JUMP_MIN_KG = 10;

export type JumpVerdict = {
  /** true → прирост неправдоподобен, вероятно ошибка ввода. */
  suspicious: boolean;
  /** currentKg − previousKg (>0 при росте). */
  deltaKg: number;
  /** Доля прироста относительно прошлого (0.6 = +60%); 0 если нет базы. */
  pct: number;
};

/** Оценить, не является ли прирост e1RM подозрительно большим.
 *  previousKg <= 0 → базы нет, скачок не флагуем (трактуется как «новое»).
 *  Регресс/равенство → не подозрительно. */
export function assessProgressJump(
  previousKg: number,
  currentKg: number,
): JumpVerdict {
  const hasBase = Number.isFinite(previousKg) && previousKg > 0;
  const deltaKg = Number.isFinite(currentKg) && hasBase ? currentKg - previousKg : 0;
  const pct = hasBase ? deltaKg / previousKg : 0;
  const suspicious =
    hasBase && deltaKg >= SUSPICIOUS_JUMP_MIN_KG && pct >= SUSPICIOUS_JUMP_PCT;
  return { suspicious, deltaKg, pct };
}
