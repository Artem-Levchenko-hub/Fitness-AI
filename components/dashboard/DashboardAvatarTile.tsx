import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { BodySilhouette } from "@/components/avatar/BodySilhouette";
import type { AvatarMuscleDatum } from "@/components/avatar/types";
import {
  activeRegionCount,
  buildBodyMap,
} from "@/lib/domain/avatar/body-map";
import { hottestMuscleKey } from "@/lib/domain/avatar/hottest";
import { muscleLabelRu } from "@/lib/domain/avatar/heat";

/** H9.2 — мини-аватар на дашборд-витрине. Статичный снапшот текущего нагрева:
 *  компактный силуэт (перёд + спина), где каждая из 14 групп закрашена своим
 *  heat-цветом. Тап ведёт в полный 3D-аватар на /profile (там выбор/история).
 *
 *  Намеренно НЕ WebGL и НЕ next/dynamic-канвас: инлайновый SVG не тянет three.js
 *  в бандл главной (LCP не страдает — строго лучше ленивой загрузки тяжёлой
 *  сцены) и надёжно проверяется в headless-прогоне (прецедент H6.3/H6.5 —
 *  DOM-представление нагрева вместо ненадёжного headless-WebGL). Крючок столпа 2
 *  на витрине; полный интерактив остаётся за тапом на /profile (R-01). */
export function DashboardAvatarTile({ data }: { data: AvatarMuscleDatum[] }) {
  const regions = buildBodyMap(data);
  const active = activeRegionCount(regions);
  const hottest = hottestMuscleKey(data);
  // Реальный hex heat-рампы как SVG-fill (тот же обоснованный случай, что
  // three.js в heat.ts: рендерится фактический цвет нагрева, а не CSS-токен).
  const colorByKey = new Map(regions.map((r) => [r.key, r.color]));

  return (
    <Link
      href="/profile"
      data-testid="dashboard-avatar-tile"
      aria-label="Карта мышц — открыть профиль"
      className="bg-card border-border hover:border-foreground/20 flex min-h-14 items-center gap-4 rounded-2xl border p-4 transition-colors"
    >
      <BodySilhouette
        ariaLabel="Силуэт мышц по нагрузке"
        className="h-24 w-28"
        shapeFill={(key) => ({ fill: colorByKey.get(key) ?? "#5b626b" })}
      />

      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
          Карта мышц
        </p>
        <p className="text-foreground mt-1 text-sm font-medium">
          {active > 0 ? (
            <>
              {active} {groupsPlural(active)} нагружено за неделю
            </>
          ) : (
            "Пока серо — заверши тренировку"
          )}
        </p>
        {hottest ? (
          <p className="text-muted-foreground mt-0.5 text-xs">
            Самая горячая: {muscleLabelRu(hottest)}
          </p>
        ) : null}
      </div>

      <ChevronRight
        className="text-muted-foreground size-4 shrink-0"
        aria-hidden="true"
      />
    </Link>
  );
}

function groupsPlural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "группа";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "группы";
  return "групп";
}
