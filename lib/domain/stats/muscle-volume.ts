/** Строка вклада в объём группы мышц: одна (группа × роль) с уже
 *  просуммированным тоннажем этого источника (силовые ИЛИ круговые). */
export type MuscleVolumeRow = {
  muscleKey: string;
  role: "primary" | "secondary";
  volume: number;
};

export type MuscleVolume = {
  muscleKey: string;
  volume: number;
};

/** Вес роли в нагрузке группы: primary = полный вклад, secondary = половина —
 *  стандарт оценки (жим грузит грудь полностью, трицепс наполовину). */
export function roleFactor(role: "primary" | "secondary"): number {
  return role === "primary" ? 1 : 0.5;
}

/** Сворачивает строки «группа × роль × тоннаж» в тоннаж на группу с role-fold
 *  (primary 1.0 / secondary 0.5), отсортировано по убыванию. ОДНО место знает
 *  правило свёртки (R-04 — раньше дублировалось в volumeByMuscle, weeklyReview,
 *  muscleHeatProfile). Источники (силовые + круговые) просто конкатенируются на
 *  входе — группа из двух форматов суммируется. Чистая логика (R-7). */
export function foldMuscleVolume(rows: MuscleVolumeRow[]): MuscleVolume[] {
  const acc = new Map<string, number>();
  for (const r of rows) {
    acc.set(r.muscleKey, (acc.get(r.muscleKey) ?? 0) + r.volume * roleFactor(r.role));
  }
  return [...acc.entries()]
    .map(([muscleKey, volume]) => ({ muscleKey, volume }))
    .sort((a, b) => b.volume - a.volume);
}
