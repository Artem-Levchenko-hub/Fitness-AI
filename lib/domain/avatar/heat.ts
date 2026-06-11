/** Доменная модель «нагрева» 3D-аватара. Объём мышцы за последние 7 дней
 *  сравнивается с её СОБСТВЕННОЙ нормой (среднее недельное за прошлые недели):
 *  серый (не тренировал) → красный (норма и выше). Чистый модуль — нет импортов
 *  из db/three/ui (R-7). Единственный источник правды для цвета мышцы; rendering
 *  и repo зависят от него, не наоборот. */

/** Канонический упорядоченный список 14 групп мышц. Значения совпадают с pgEnum
 *  `muscle_group_key` (db/schema/enums.ts), но домен НЕ импортирует слой БД
 *  (R-7) — это независимая доменная константа. Тест в heat.test.ts ловит
 *  расхождение, если enum изменится. */
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
  /** current7d / baselineWeekly. `null`, когда нормы нет (мышца ни разу не
   *  тренировалась в baseline-окне) — сравнивать не с чем. */
  ratio: number | null;
  level: HeatLevel;
  /** Позиция на цветовой рампе [0,1]: 0 = серый (dormant), 1 = красный (peak). */
  t: number;
};

/** Соотношение, при котором мышца считается «раскалённой» (полный красный).
 *  1.25 = на 25% выше собственной нормы → «отлично потренировался». */
const PEAK_RATIO = 1.25;

/** Позиция на рампе для новой мышцы (тренировал, но нормы ещё нет): тёплый
 *  оттенок между high и peak — нагрузку видно, но «пик» заявить нельзя без базы. */
const NEW_MUSCLE_T = 0.72;

/** Уровень нагрева мышцы из объёма за 7 дней и недельной нормы.
 *  - current7d = 0 → dormant (серый), независимо от базы.
 *  - база есть → ratio = current/база; уровень по порогам; t = ratio/PEAK_RATIO.
 *  - базы нет, но тренировал → ratio=null, high (поощряем нагрузку, пик не
 *    заявляем — не с чем сравнить). */
export function heatLevel(current7d: number, baselineWeekly: number): Heat {
  if (current7d <= 0) {
    return {
      ratio: baselineWeekly > 0 ? 0 : null,
      level: "dormant",
      t: 0,
    };
  }

  if (baselineWeekly <= 0) {
    return { ratio: null, level: "high", t: NEW_MUSCLE_T };
  }

  const ratio = current7d / baselineWeekly;
  const t = clamp01(ratio / PEAK_RATIO);

  let level: HeatLevel;
  if (ratio < 0.5) level = "low";
  else if (ratio < 1.0) level = "normal";
  else if (ratio < PEAK_RATIO) level = "high";
  else level = "peak";

  return { ratio, level, t };
}

/** Цветовая рампа «нагрева»: серый → янтарь → оранжевый → красный (термальный
 *  градиент «тело разогревается»). Линейная RGB-интерполяция между опорными
 *  стопами. Выход — hex (three.Color и CSS принимают его без вопросов; oklch
 *  поддержан не во всех версиях three). R-36-нюанс: рампа жёстко закодирована
 *  здесь как доменная константа (single source), а не Tailwind-токены, т.к.
 *  three.js рендерит реальный цвет, а не CSS-класс — см. спек. */
const RAMP: ReadonlyArray<{ t: number; rgb: [number, number, number] }> = [
  { t: 0.0, rgb: [0x6b, 0x6b, 0x66] }, // тёплый серый — холодная мышца
  { t: 0.35, rgb: [0xd4, 0xa0, 0x2c] }, // янтарь
  { t: 0.7, rgb: [0xe2, 0x6d, 0x2a] }, // оранжевый
  { t: 1.0, rgb: [0xd6, 0x28, 0x28] }, // раскалённый красный
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
