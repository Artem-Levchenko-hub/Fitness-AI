/** Оценки максимума на 1 повторение по силовому подходу.
 *  Pure functions — никаких импортов из БД/Auth/UI (R-7). */

const EPLEY_DIVISOR = 30;
const BRZYCKI_NUMERATOR = 36;
const BRZYCKI_DENOMINATOR_BASE = 37;

/** Epley: weight × (1 + reps / 30). Хорошо для 1-10 reps. */
export function epleyOneRepMax(weightKg: number, reps: number): number {
  if (reps < 1) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / EPLEY_DIVISOR);
}

/** Brzycki: weight × 36 / (37 - reps). Точнее для 1-15 reps.
 *  Возвращает 0 если reps >= 37 (формула не определена). */
export function brzyckiOneRepMax(weightKg: number, reps: number): number {
  if (reps < 1 || reps >= BRZYCKI_DENOMINATOR_BASE) return 0;
  if (reps === 1) return weightKg;
  return (weightKg * BRZYCKI_NUMERATOR) / (BRZYCKI_DENOMINATOR_BASE - reps);
}

/** Среднее из Epley и Brzycki — наша оценка 1RM по умолчанию. */
export function estimatedOneRepMax(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps < 1) return 0;
  if (reps === 1) return weightKg;
  return (
    (epleyOneRepMax(weightKg, reps) + brzyckiOneRepMax(weightKg, reps)) / 2
  );
}

export type SetForOneRepMax = {
  weightKg: number;
  reps: number;
  setType?: "working" | "warmup" | "drop" | "failure";
};

/** Лучший расчётный 1RM из массива подходов (учитываем только working). */
export function bestEstimatedOneRepMax(
  sets: ReadonlyArray<SetForOneRepMax>,
): number {
  let best = 0;
  for (const s of sets) {
    if (s.setType && s.setType !== "working") continue;
    const e = estimatedOneRepMax(s.weightKg, s.reps);
    if (e > best) best = e;
  }
  return best;
}
