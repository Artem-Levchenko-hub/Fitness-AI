import {
  buildHistory,
  type HistoryItem,
} from "@/lib/domain/workouts/history";
import type { CardioSummary } from "@/lib/repos/cardio.repo";
import type { CircuitSummary } from "@/lib/repos/circuits.repo";
import type { RecentWorkout } from "@/lib/repos/workouts.repo";

/** Лента активности друзей (H3.2). ЕДИНСТВЕННЫЙ носитель знания «последнее
 *  событие друга + как его подписать» — лента /friends и (позже) превью-строка
 *  тайла «Друзья» на дашборде (H3.1) читают РОВНО отсюда, чтобы два носителя не
 *  разошлись (урок H4.3). Чистая доменная логика (R-7): тип-импорты репозиториев,
 *  без db/React — покрыта node-юнит-тестами.
 *
 *  Только тип-импорты из lib/repos (RecentWorkout/CircuitSummary/CardioSummary),
 *  прецедент lib/domain/workouts/history.ts — направление зависимостей не нарушено. */

/** Последнее ЗАВЕРШЁННОЕ событие друга среди всех трёх форматов
 *  (силовая+круговая+кардио), либо null если завершённых сессий нет. Поверх
 *  buildHistory — тот же источник истины, что лента /workouts и дашборд: иначе
 *  круговая/кардио друга «пропадут», как weekCount до H12.0 (столп 4). */
export function selectLastEvent(
  strength: RecentWorkout[],
  circuits: CircuitSummary[],
  cardio: CardioSummary[],
): HistoryItem | null {
  return buildHistory(strength, circuits, cardio)[0] ?? null;
}

/** Человекочитаемый формат события для бейджа строки (R-41: формат = текст, не
 *  только цвет). Гранулярность пресета кардио живёт в метрике/detail-роуте —
 *  ленте достаточно крупного формата. */
export function friendEventFormat(item: HistoryItem): string {
  switch (item.kind) {
    case "strength":
      return "Силовая";
    case "circuit":
      return "Круговая";
    case "cardio":
      return "Кардио";
  }
}

/** Одна метрика-заголовок события для строки ленты, формат-зависимая.
 *  Силовая → тоннаж РОВНО как на странице друга (Math.round + ru-RU) — гейт
 *  H3.2 «тоннаж совпадает со страницей друга». Круговая/кардио тоннажа не имеют
 *  → их собственные ключевые метрики (кругов/упр., минуты). Никогда не пустая
 *  (R-10/R-37): у кардио без фактического времени берём плановое. */
export function friendEventMeta(item: HistoryItem): string {
  switch (item.kind) {
    case "strength":
      return `${Math.round(item.tonnageKg).toLocaleString("ru-RU")} kg·reps`;
    case "circuit":
      return `${item.totalRounds} кругов · ${item.exerciseCount} упр.`;
    case "cardio": {
      const sec = item.totalActualSec || item.totalPlannedSec;
      const min = sec > 0 ? Math.max(1, Math.round(sec / 60)) : 0;
      return `${min} мин`;
    }
  }
}

/** Лента-порядок: друзья с недавним событием первыми (новые сверху), друзья без
 *  событий — в конец. Чистая (без Date.now): сортирует копию по startedAt
 *  существующих событий. Generic, чтобы покрыть и repo-DTO, и тест-фикстуру. */
export function sortFriendsByRecency<T extends { lastEvent: HistoryItem | null }>(
  list: T[],
): T[] {
  return [...list].sort((a, b) => {
    const ta = a.lastEvent?.startedAt.getTime() ?? -Infinity;
    const tb = b.lastEvent?.startedAt.getTime() ?? -Infinity;
    return tb - ta;
  });
}
