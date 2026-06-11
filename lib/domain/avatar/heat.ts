/** Доменная модель «нагрева» 3D-аватара. Цвет мышцы определяется АБСОЛЮТНЫМ
 *  числом рабочих подходов на группу за последнюю неделю: серый (не тренировал)
 *  → красный (норма и выше). Норма ≈ SETS_PEAK подходов/нед — спорт-научный
 *  ориентир для гипертрофии (10–20 подходов/нед на группу). По-человечески:
 *  0 → серый, ~5 → серо-красный, ≥SETS_PEAK → ярко-красный.
 *
 *  Чистый модуль — нет импортов из db/three/ui (R-7). Единственный источник
 *  правды для цвета мышцы. */

/** Канонический упорядоченный список 14 групп мышц. Значения совпадают с pgEnum
 *  `muscle_group_key` (db/schema/enums.ts), но домен НЕ импортирует слой БД
 *  (R-7) — это независимая доменная константа. Тест ловит расхождение. */
export const MUSCLE_KEYS = [
  "chest",
  "back_lats",
  "back_traps",
  "shoulders_front",
  "shoulders_side",
  "shoulders_rear",
  "biceps",
  "triceps",
  "forearms",
  "core",
  "glutes",
  "quads",
  "hamstrings",
  "calves",
] as const;

export type MuscleKey = (typeof MUSCLE_KEYS)[number];

export type HeatLevel = "dormant" | "low" | "normal" | "high" | "peak";

export type Heat = {
  /** Эффективные рабочие подходы на группу за неделю (primary 1.0,
   *  secondary 0.5; силовые + круговые). */
  weeklySets: number;
  level: HeatLevel;
  /** Позиция на цветовой рампе [0,1]: 0 = серый (dormant), 1 = красный (peak). */
  t: number;
};

/** Число подходов/нед на группу, при котором мышца «раскалена» (полный красный).
 *  15 — середина спорт-научного коридора 10–20 подходов/нед для гипертрофии. */
export const SETS_PEAK = 15;

/** Нагрев мышцы из числа рабочих подходов за неделю.
 *  - 0 → dormant (серый).
 *  - иначе t = weeklySets / SETS_PEAK (клампится в 1); уровень по порогам. */
export function heatFromSets(weeklySets: number): Heat {
  if (weeklySets <= 0) {
    return { weeklySets: 0, level: "dormant", t: 0 };
  }
  const t = clamp01(weeklySets / SETS_PEAK);
  let level: HeatLevel;
  if (weeklySets < 5) level = "low";
  else if (weeklySets < 10) level = "normal";
  else if (weeklySets < SETS_PEAK) level = "high";
  else level = "peak";
  return { weeklySets, level, t };
}

/** Цветовая рампа «нагрева»: серый → янтарь → оранжевый → красный (термальный
 *  градиент «тело разогревается»). Линейная RGB-интерполяция между опорными
 *  стопами. Выход — hex (three.Color и CSS принимают его без вопросов). R-36:
 *  рампа закодирована здесь как доменная константа (single source), а не
 *  Tailwind-токены — three.js рендерит реальный цвет, а не CSS-класс. */
const RAMP: ReadonlyArray<{ t: number; rgb: [number, number, number] }> = [
  { t: 0.0, rgb: [0x5b, 0x62, 0x6b] }, // прохладный сланец — холодная мышца
  { t: 0.26, rgb: [0xe0, 0xa5, 0x2a] }, // золото
  { t: 0.5, rgb: [0xf2, 0x73, 0x1e] }, // оранжевый
  { t: 0.76, rgb: [0xe5, 0x35, 0x2c] }, // красный
  { t: 1.0, rgb: [0xe5, 0x0a, 0x46] }, // алый-малиновый — «на огне»
];

export function heatColorStop(t: number): string {
  const x = clamp01(t);
  for (let i = 1; i < RAMP.length; i++) {
    const lo = RAMP[i - 1]!;
    const hi = RAMP[i]!;
    if (x <= hi.t) {
      const span = hi.t - lo.t;
      const f = span > 0 ? (x - lo.t) / span : 0;
      return toHex(lerpRgb(lo.rgb, hi.rgb, f));
    }
  }
  return toHex(RAMP[RAMP.length - 1]!.rgb);
}

const LEVEL_LABELS_RU: Record<HeatLevel, string> = {
  dormant: "Отдыхает",
  low: "Лёгкая нагрузка",
  normal: "В норме",
  high: "Хорошо нагружена",
  peak: "На пике",
};

export function heatLabel(level: HeatLevel): string {
  return LEVEL_LABELS_RU[level];
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function lerpRgb(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  f: number,
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

function toHex(rgb: [number, number, number]): string {
  return (
    "#" +
    rgb
      .map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0"))
      .join("")
  );
}
