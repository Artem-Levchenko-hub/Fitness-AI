import {
  friendDisplayName,
  friendEventFormat,
  friendEventMeta,
} from "@/lib/domain/friends/friend-activity";
import type { FriendActivity } from "@/lib/repos/friends.repo";

/** Превью-строка тайла «Друзья» на дашборде (H3.1): одно самое свежее событие
 *  среди всех друзей. Читает РОВНО те же форматтеры, что карточка ленты /friends
 *  (friendDisplayName · friendEventFormat · friendEventMeta), поэтому строка не
 *  расходится с верхней карточкой ленты (урок H4.3). Серверный компонент — ноль
 *  клиентского JS, дашборд не тянет новых бандлов (гейт H3.1). lastEvent null
 *  здесь не ожидается (вызывающий передаёт только топ с событием), но на всякий
 *  случай возвращаем null (R-10). */
export function FriendsActivityPreview({
  activity,
}: {
  activity: FriendActivity;
}) {
  const { user, lastEvent } = activity;
  if (!lastEvent) return null;
  return (
    <p className="text-muted-foreground mt-0.5 truncate text-xs leading-snug">
      {friendDisplayName(user)} · {friendEventFormat(lastEvent)} ·{" "}
      {friendEventMeta(lastEvent)}
    </p>
  );
}
