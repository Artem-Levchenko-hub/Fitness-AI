import { ChevronRight } from "lucide-react";
import Link from "next/link";

import type { AvatarMuscleDatum } from "@/components/avatar/types";
import {
  activeRegionCount,
  buildBodyMap,
  type MuscleRegion,
} from "@/lib/domain/avatar/body-map";
import { hottestMuscleKey } from "@/lib/domain/avatar/hottest";
import { muscleLabelRu, type MuscleKey } from "@/lib/domain/avatar/heat";

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

  return (
    <Link
      href="/profile"
      data-testid="dashboard-avatar-tile"
      aria-label="Карта мышц — открыть профиль"
      className="bg-card border-border hover:border-foreground/20 flex min-h-14 items-center gap-4 rounded-2xl border p-4 transition-colors"
    >
      <BodySilhouette regions={regions} />

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

/** Два миниатюрных силуэта (перёд+спина): каждая группа — набор простых фигур,
 *  закрашенных её heat-цветом. Цвет идёт на SVG-атрибут fill (реальный цвет
 *  доменной рампы, не Tailwind-токен — тот же обоснованный случай, что three.js
 *  в heat.ts: рендерится фактический цвет нагрева, а не CSS-класс). */
function BodySilhouette({ regions }: { regions: MuscleRegion[] }) {
  const colorByKey = new Map(regions.map((r) => [r.key, r.color]));
  return (
    <svg
      viewBox="0 0 120 96"
      className="h-24 w-28 shrink-0"
      role="img"
      aria-label="Силуэт мышц по нагрузке"
    >
      {/* Нейтральные части (голова) — не несут нагрева. */}
      <circle cx="30" cy="9" r="6" className="fill-muted-foreground/30" />
      <circle cx="90" cy="9" r="6" className="fill-muted-foreground/30" />
      {MUSCLE_SHAPES.map(({ key, shapes }) =>
        shapes.map((s, i) => {
          const fill = colorByKey.get(key) ?? "#5b626b";
          return s.t === "r" ? (
            <rect
              key={`${key}-${i}`}
              data-muscle={key}
              x={s.x}
              y={s.y}
              width={s.w}
              height={s.h}
              rx={s.rx ?? 2}
              fill={fill}
            />
          ) : (
            <ellipse
              key={`${key}-${i}`}
              data-muscle={key}
              cx={s.cx}
              cy={s.cy}
              rx={s.rx ?? 4}
              ry={s.ry ?? 4}
              fill={fill}
            />
          );
        }),
      )}
    </svg>
  );
}

type Shape =
  | { t: "r"; x: number; y: number; w: number; h: number; rx?: number }
  | { t: "e"; cx: number; cy: number; rx?: number; ry?: number };

/** Геометрия мини-силуэта. ПЕРЁД (центр x≈30): группы, видимые спереди. СПИНА
 *  (центр x≈90): задние группы. Каждый ключ ровно в одной фигуре (forearms — на
 *  переде, calves — на спине), чтобы 14 групп покрылись без дублей. Абстрактно,
 *  но читаемо как тело: симметричные пары L/R. */
const MUSCLE_SHAPES: Array<{ key: MuscleKey; shapes: Shape[] }> = [
  // --- ПЕРЁД ---
  {
    key: "shoulders_side",
    shapes: [
      { t: "e", cx: 15, cy: 25, rx: 4, ry: 5 },
      { t: "e", cx: 45, cy: 25, rx: 4, ry: 5 },
    ],
  },
  {
    key: "shoulders_front",
    shapes: [
      { t: "e", cx: 22, cy: 23, rx: 3.5, ry: 4 },
      { t: "e", cx: 38, cy: 23, rx: 3.5, ry: 4 },
    ],
  },
  {
    key: "chest",
    shapes: [
      { t: "r", x: 20, y: 27, w: 8, h: 9, rx: 2 },
      { t: "r", x: 32, y: 27, w: 8, h: 9, rx: 2 },
    ],
  },
  {
    key: "biceps",
    shapes: [
      { t: "r", x: 11, y: 30, w: 5, h: 14, rx: 2.5 },
      { t: "r", x: 44, y: 30, w: 5, h: 14, rx: 2.5 },
    ],
  },
  {
    key: "core",
    shapes: [{ t: "r", x: 24, y: 37, w: 12, h: 15, rx: 2 }],
  },
  {
    key: "forearms",
    shapes: [
      { t: "r", x: 10, y: 46, w: 5, h: 14, rx: 2.5 },
      { t: "r", x: 45, y: 46, w: 5, h: 14, rx: 2.5 },
    ],
  },
  {
    key: "quads",
    shapes: [
      { t: "r", x: 22, y: 53, w: 7, h: 21, rx: 3 },
      { t: "r", x: 31, y: 53, w: 7, h: 21, rx: 3 },
    ],
  },
  // --- СПИНА ---
  {
    key: "back_traps",
    shapes: [{ t: "r", x: 82, y: 18, w: 16, h: 8, rx: 3 }],
  },
  {
    key: "shoulders_rear",
    shapes: [
      { t: "e", cx: 75, cy: 25, rx: 4, ry: 5 },
      { t: "e", cx: 105, cy: 25, rx: 4, ry: 5 },
    ],
  },
  {
    key: "back_lats",
    shapes: [
      { t: "r", x: 80, y: 27, w: 8, h: 13, rx: 2 },
      { t: "r", x: 92, y: 27, w: 8, h: 13, rx: 2 },
    ],
  },
  {
    key: "triceps",
    shapes: [
      { t: "r", x: 71, y: 30, w: 5, h: 14, rx: 2.5 },
      { t: "r", x: 104, y: 30, w: 5, h: 14, rx: 2.5 },
    ],
  },
  {
    key: "glutes",
    shapes: [
      { t: "r", x: 82, y: 41, w: 8, h: 9, rx: 3 },
      { t: "r", x: 90, y: 41, w: 8, h: 9, rx: 3 },
    ],
  },
  {
    key: "hamstrings",
    shapes: [
      { t: "r", x: 82, y: 51, w: 7, h: 18, rx: 3 },
      { t: "r", x: 91, y: 51, w: 7, h: 18, rx: 3 },
    ],
  },
  {
    key: "calves",
    shapes: [
      { t: "r", x: 83, y: 71, w: 6, h: 15, rx: 3 },
      { t: "r", x: 91, y: 71, w: 6, h: 15, rx: 3 },
    ],
  },
];

function groupsPlural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "группа";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "группы";
  return "групп";
}
