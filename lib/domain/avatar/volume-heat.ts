import { heatColorStop, MUSCLE_KEYS, type MuscleKey } from "./heat";

/** Точка объёма по группе мышц за период (форма `volumeByMuscle` из stats.repo). */
export type VolumePoint = { muscleKey: string; volume: number };

const KEY_SET = new Set<string>(MUSCLE_KEYS);

/** H17.2 — heat-цвет каждой из 14 групп из тоннажа за период, нормированного на
 *  максимум по набору. `t = vol / maxVol` → `heatColorStop` (та же рампа, что
 *  3D-аватар). Та же база максимума, что длина бара в MuscleVolumeBars →
 *  цвет силуэта монотонен бару by-construction (гейт). Группа без объёма (нет в
 *  data, 0/отрицательный, или неизвестный ключ) → t=0 → серый (R-10/R-37 fail-soft).
 *  Чистый модуль — без импортов из db/next/ui (R-7). */
export function volumeHeatColors(data: VolumePoint[]): Record<MuscleKey, string> {
  // Только известные группы с реальным (>0) объёмом участвуют в максимуме —
  // выдуманный ключ или мусорное значение не должны смещать нормировку.
  const byKey = new Map<MuscleKey, number>();
  for (const d of data) {
    if (d.volume > 0 && KEY_SET.has(d.muscleKey)) {
      byKey.set(d.muscleKey as MuscleKey, d.volume);
    }
  }
  const max = Math.max(0, ...byKey.values());

  const out = {} as Record<MuscleKey, string>;
  for (const key of MUSCLE_KEYS) {
    const vol = byKey.get(key) ?? 0;
    const t = max > 0 ? vol / max : 0;
    out[key] = heatColorStop(t);
  }
  return out;
}
