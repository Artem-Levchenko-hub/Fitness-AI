import { BodySilhouette } from "@/components/avatar/BodySilhouette";
import {
  avatarHeatColors,
  type HeatColorPoint,
} from "@/lib/domain/avatar/heat-colors";

/** H3.5 (sub-slice A) — режим сравнения нагрузки на /friends/[friendId]: мой
 *  heat-силуэт рядом с силуэтом друга. ОБА — инлайн-SVG BodySilhouette (H9.2),
 *  НЕ второй three.js-канвас (два WebGL на мобиле = перф-самоубийство, critical
 *  concern 7). Цвет каждой группы — её абсолютный нагрев (avatarHeatColors), та
 *  же рампа, что 3D-аватар → различимо, чья группа горячее. Данные друга — уже
 *  за areFriends-гейтом страницы (R-7). Read-only; тапы (вход в данные) — sub-
 *  slice B. */
export function HeatComparison({
  mine,
  theirs,
  friendName,
}: {
  mine: HeatColorPoint[];
  theirs: HeatColorPoint[];
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
      <div className="bg-card/40 border-border grid grid-cols-2 gap-3 rounded-2xl border p-4">
        <SilhouetteCell
          colors={myColors}
          caption="Вы"
          ariaLabel="Ваша нагрузка по группам мышц за неделю"
        />
        <SilhouetteCell
          colors={theirColors}
          caption={friendName}
          ariaLabel={`Нагрузка ${friendName} по группам мышц за неделю`}
        />
      </div>
    </section>
  );
}

function SilhouetteCell({
  colors,
  caption,
  ariaLabel,
}: {
  colors: Record<string, string>;
  caption: string;
  ariaLabel: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <BodySilhouette
        ariaLabel={ariaLabel}
        className="h-24 w-full"
        shapeFill={(key) => ({ fill: colors[key] })}
      />
      <p className="text-muted-foreground max-w-full truncate text-center text-xs font-medium">
        {caption}
      </p>
    </div>
  );
}
