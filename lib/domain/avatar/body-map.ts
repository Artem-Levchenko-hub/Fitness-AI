/** Мини-карта мышц для дашборд-витрины (H9.2): берёт готовый нагрев аватара и
 *  раскладывает его в КАНОНИЧЕСКИЙ список всех 14 групп — с цветом для каждой,
 *  включая те, что атлет на этой неделе не трогал (они получают серый-dormant,
 *  а не выпадают из силуэта). Чистый модуль (R-7): нет импортов db/three/ui —
 *  единственный источник правды «как из нагрева получить полный набор регионов
 *  тела для статичного снапшота на главной». Полный 3D-аватар (с тапом и
 *  историей) остаётся на /profile; здесь — только крючок-витрина (столп 2). */

import {
  heatColorStop,
  MUSCLE_KEYS,
  muscleLabelRu,
  type HeatLevel,
  type MuscleKey,
} from "./heat";

/** Минимум, который мини-силуэту нужен от каждой группы. Подмножество
 *  AvatarMuscleDatum — тот же серверный источник (build-avatar-data), но тайл
 *  не зависит от полей дрилл-панели (top3/records/forgotten) — R-01/R-05. */
export type RegionHeat = {
  key: string;
  color: string;
  level: HeatLevel;
  sets: number;
};

/** Один регион тела на мини-силуэте: группа мышц + её цвет нагрева. */
export type MuscleRegion = {
  key: MuscleKey;
  /** RU-название группы (для aria/title). */
  label: string;
  /** Hex-цвет нагрева (серый→красный). */
  color: string;
  level: HeatLevel;
  /** Эффективные рабочие подходы за неделю. */
  sets: number;
  /** Тренировалась ли группа на этой неделе (sets > 0). */
  active: boolean;
};

/** Серый «остывшей» мышцы (rampа в t=0) — fallback для групп без данных. */
const DORMANT_COLOR = heatColorStop(0);

/** Разложить нагрев в полный упорядоченный набор 14 регионов тела. Группы,
 *  отсутствующие во входных данных (нет за неделю ни одного подхода), получают
 *  серый-dormant — силуэт всегда целый, тёплый там, где была нагрузка. Порядок —
 *  канонический MUSCLE_KEYS (тот же, что красит 3D-аватар). */
export function buildBodyMap(
  data: ReadonlyArray<RegionHeat>,
): MuscleRegion[] {
  const byKey = new Map(data.map((d) => [d.key, d]));
  return MUSCLE_KEYS.map((key) => {
    const d = byKey.get(key);
    const sets = d?.sets ?? 0;
    return {
      key,
      label: muscleLabelRu(key),
      color: d?.color ?? DORMANT_COLOR,
      level: d?.level ?? "dormant",
      sets,
      active: sets > 0,
    };
  });
}

/** Сколько групп получило нагрузку за неделю (active). Подпись витрины
 *  «N групп нагружены». */
export function activeRegionCount(regions: ReadonlyArray<MuscleRegion>): number {
  return regions.reduce((n, r) => n + (r.active ? 1 : 0), 0);
}
