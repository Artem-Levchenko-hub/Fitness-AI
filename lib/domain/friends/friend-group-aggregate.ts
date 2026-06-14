/** H3.5 (sub-slice B) — read-only сводка одной группы мышц друга. Тап по силуэту
 *  друга на /friends/[friendId] показывает агрегат его группы (вход в данные —
 *  столп 2), но БЕЗ ссылок на упражнения: тип НАМЕРЕННО узкий (нет exerciseId/
 *  name/top3/records), поэтому утечь упражнения друга нельзя даже случайно (R-7).
 *  Данные приходят уже за areFriends-гейтом страницы. Чистый модуль (R-7 — домен
 *  не зависит от db/view). */

/** Минимальная форма AvatarMuscleDatum для сравнения друга — только агрегатные
 *  поля группы, ничего, что идентифицирует конкретные упражнения. */
export type FriendGroupDatum = {
  key: string;
  /** RU-название группы. */
  label: string;
  /** Working-подходов за 7 дней. */
  sets: number;
  /** Working-тоннаж за 7 дней (кг·повт). */
  volume7d: number;
  /** Человекочитаемый ярлык уровня нагрева. */
  levelLabel: string;
};

export type FriendGroupAggregate = Omit<FriendGroupDatum, "key">;

/** Сводка группы друга по ключу, или null если друг не тренировал эту группу за
 *  неделю (muscleHeatProfile отдаёт только задетые группы → ненайденный ключ =
 *  серая «холодная» фигура без данных → панель показывает «нет данных», R-37). */
export function selectFriendGroupAggregate(
  data: FriendGroupDatum[],
  key: string,
): FriendGroupAggregate | null {
  const found = data.find((d) => d.key === key);
  if (!found) return null;
  return {
    label: found.label,
    sets: found.sets,
    volume7d: found.volume7d,
    levelLabel: found.levelLabel,
  };
}
