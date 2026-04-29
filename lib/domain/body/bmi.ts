/** BMI и связанные helpers — pure TS (R-7). */

export function calculateBmi(weightKg: number, heightCm: number): number | null {
  if (weightKg <= 0 || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export type BmiCategory = "underweight" | "normal" | "overweight" | "obese";

/** WHO classification. Для атлетов с большой мышечной массой эта шкала
 *  даёт false positives — но AI-коучу полезно знать категорию для
 *  контекста. */
export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "overweight";
  return "obese";
}

/** Возраст в полных годах от даты рождения. */
export function ageFromBirthDate(
  birthDate: Date,
  now: Date = new Date(),
): number {
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && now.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }
  return age;
}

/** Lean body mass = weight × (1 − BF%/100). Для отслеживания roster mass. */
export function leanBodyMassKg(
  weightKg: number,
  bodyFatPct: number,
): number | null {
  if (weightKg <= 0 || bodyFatPct < 0 || bodyFatPct >= 100) return null;
  return weightKg * (1 - bodyFatPct / 100);
}

/** Соотношение талия/рост. >0.5 — повышенный риск висцерального жира.
 *  Простой health-флаг. */
export function waistToHeightRatio(
  waistCm: number,
  heightCm: number,
): number | null {
  if (waistCm <= 0 || heightCm <= 0) return null;
  return waistCm / heightCm;
}
