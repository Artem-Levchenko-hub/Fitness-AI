import { HeatSilhouettes } from "@/components/friends/HeatSilhouettes";
import {
  avatarHeatColors,
  type HeatColorPoint,
} from "@/lib/domain/avatar/heat-colors";
import type { FriendGroupDatum } from "@/lib/domain/friends/friend-group-aggregate";

/** H3.5 — режим сравнения нагрузки на /friends/[friendId]: мой heat-силуэт рядом
 *  с силуэтом друга. ОБА — инлайн-SVG BodySilhouette (H9.2), НЕ второй three.js-
 *  канвас (два WebGL на мобиле = перф-самоубийство, critical concern 7). Цвет
 *  каждой группы — её абсолютный нагрев (avatarHeatColors), та же рампа, что 3D-
 *  аватар → различимо, чья группа горячее. Данные друга — уже за areFriends-
 *  гейтом страницы (R-7).
 *
 *  Сервер готовит цвета + узкий агрегат друга; тапы (вход в данные, sub-slice B)
 *  несёт клиентский HeatSilhouettes. */
export function HeatComparison({
  mine,
  theirs,
  theirData,
  friendName,
}: {
  mine: HeatColorPoint[];
  theirs: HeatColorPoint[];
  /** Узкая сводка групп друга (без упражнений, R-7) для read-only панели тапа. */
  theirData: FriendGroupDatum[];
  /** Имя друга для подписи под его силуэтом. */
  friendName: string;
}) {
  const myColors = avatarHeatColors(mine);
  const theirColors = avatarHeatColors(theirs);

  return (
    <section data-heat-comparison className="mb-6">
      <h2 className="mb-3 text-sm font-semibold tracking-tight">
        Сравнение нагрузки
      </h2>
      <HeatSilhouettes
        myColors={myColors}
        theirColors={theirColors}
        theirData={theirData}
        friendName={friendName}
      />
    </section>
  );
}
