import { cn } from "@/lib/utils/index";
import type { MuscleKey } from "@/lib/domain/avatar/heat";

/** Мини-силуэт мышц (перёд + спина) — инлайновый SVG, НЕ WebGL/three.js: не
 *  тянет тяжёлую сцену в бандл и надёжно проверяется в headless-прогоне
 *  (прецедент H6.3/H6.5 — DOM-представление вместо ненадёжного headless-WebGL).
 *  Источник правды геометрии (где какая из 14 групп сидит на силуэте) — общий
 *  для дашборд-витрины (H9.2, heat-цвет) и карточки ожидания разбора (H16.4,
 *  подсветка групп сессии). Чем красить каждую группу — решает вызывающий через
 *  `shapeFill` (fill-атрибут для реального hex-цвета нагрева ИЛИ className для
 *  токен-подсветки, R-36). */

/** Как закрасить группу: реальный hex (`fill`, напр. цвет heat-рампы) ИЛИ
 *  Tailwind-токен-класс (`className`). Один из двух. */
export type ShapeFill = (key: MuscleKey) => { fill?: string; className?: string };

export function BodySilhouette({
  shapeFill,
  className,
  ariaLabel,
}: {
  shapeFill: ShapeFill;
  /** Размер/позиционирование силуэта (h-/w-/shrink-0). */
  className?: string;
  ariaLabel: string;
}) {
  return (
    <svg
      viewBox="0 0 120 96"
      className={cn("shrink-0", className)}
      role="img"
      aria-label={ariaLabel}
    >
      {/* Нейтральные части (голова) — не несут ни нагрева, ни подсветки. */}
      <circle cx="30" cy="9" r="6" className="fill-muted-foreground/30" />
      <circle cx="90" cy="9" r="6" className="fill-muted-foreground/30" />
      {MUSCLE_SHAPES.map(({ key, shapes }) =>
        shapes.map((s, i) => {
          const paint = shapeFill(key);
          return s.t === "r" ? (
            <rect
              key={`${key}-${i}`}
              data-muscle={key}
              x={s.x}
              y={s.y}
              width={s.w}
              height={s.h}
              rx={s.rx ?? 2}
              fill={paint.fill}
              className={paint.className}
            />
          ) : (
            <ellipse
              key={`${key}-${i}`}
              data-muscle={key}
              cx={s.cx}
              cy={s.cy}
              rx={s.rx ?? 4}
              ry={s.ry ?? 4}
              fill={paint.fill}
              className={paint.className}
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
