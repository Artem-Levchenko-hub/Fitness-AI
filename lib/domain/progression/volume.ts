export type SetForVolume = {
  weightKg: number;
  reps: number;
  setType?: "working" | "warmup" | "drop" | "failure";
};

/** Объём одного подхода — weight × reps. */
export function setVolume(set: { weightKg: number; reps: number }): number {
  return set.weightKg * set.reps;
}

/** Тоннаж — сумма volume по working-подходам. Warmup/drop не учитываются. */
export function totalVolume(sets: ReadonlyArray<SetForVolume>): number {
  return sets.reduce((sum, s) => {
    if (s.setType && s.setType !== "working") return sum;
    return sum + setVolume(s);
  }, 0);
}

export type MuscleBinding = { key: string; role: "primary" | "secondary" };

/** Распределяет объём упражнения по группам мышц. Primary = 1.0,
 *  secondary = 0.5 (стандарт Hevy/Strong для оценки нагрузки). */
export function distributeVolumeByMuscle(
  sets: ReadonlyArray<SetForVolume>,
  muscles: ReadonlyArray<MuscleBinding>,
): Record<string, number> {
  const total = totalVolume(sets);
  const result: Record<string, number> = {};
  for (const m of muscles) {
    const weight = m.role === "primary" ? 1.0 : 0.5;
    result[m.key] = (result[m.key] ?? 0) + total * weight;
  }
  return result;
}

/** Сложить распределения по нескольким упражнениям. */
export function mergeMuscleVolumes(
  parts: ReadonlyArray<Record<string, number>>,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const part of parts) {
    for (const [key, value] of Object.entries(part)) {
      result[key] = (result[key] ?? 0) + value;
    }
  }
  return result;
}
