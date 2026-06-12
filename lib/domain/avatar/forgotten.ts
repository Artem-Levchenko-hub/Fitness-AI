/** «Забытые мышцы» (H6.4): группа, не получавшая нагрузки ≥FORGOTTEN_WEEKS
 *  недель, помечается на аватаре отдельно (не только цветом — R-41) и несёт
 *  бейдж срока в дрилл-панели. Чистый модуль (R-7): нет импортов db/three/ui —
 *  единственный источник правды для «сколько недель без нагрузки». */

const DAY_MS = 86_400_000;

/** Порог «забытости»: с этого числа полных недель без нагрузки группа считается
 *  забытой. 2 недели — за гранью обычного сплита/деелоада, сигнал реального
 *  пропуска, а не плановой паузы. */
export const FORGOTTEN_WEEKS = 2;

/** Сколько ПОЛНЫХ недель прошло с последней (всевременной) нагрузки группы.
 *  - `lastTrainedAt === null` (никогда не тренировалась) → `null`: «N недель»
 *    для нетронутой группы не утверждаем (она просто серая-dormant).
 *  - тренировалась недавно (< FORGOTTEN_WEEKS недель) → `null` (не забыта).
 *  - иначе → число недель (floor дней/7).
 *
 *  «Недели» — катящиеся 7-дневки от последней нагрузки (интуитивный счёт «21+
 *  дней = 3 недели»), НЕ ISO-календарные границы: так бейдж читается ровно и без
 *  крайних случаев перехода года. */
export function forgottenWeeks(
  lastTrainedAt: Date | null,
  now: Date,
): number | null {
  if (!lastTrainedAt) return null;
  const days = Math.floor((now.getTime() - lastTrainedAt.getTime()) / DAY_MS);
  if (days < 0) return null; // дата в будущем — мусор, игнор
  const weeks = Math.floor(days / 7);
  return weeks >= FORGOTTEN_WEEKS ? weeks : null;
}

/** Бейдж срока для забытой группы: «3 недели без нагрузки». RU-плюрализация. */
export function forgottenLabel(weeks: number): string {
  return `${weeks} ${pluralWeeks(weeks)} без нагрузки`;
}

function pluralWeeks(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "неделя";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "недели";
  return "недель";
}
