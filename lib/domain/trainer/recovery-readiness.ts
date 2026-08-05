/** Консервативная готовность к прогрессии. Это не медицинская оценка: она лишь
 * запрещает автоматически повышать нагрузку, когда свежие дневники сигналят о
 * слабом восстановлении. При недостатке данных тренер ничего не предполагает. */
export type RecoveryInput = {
  sleepHours: number | null;
  sleepQuality: number | null;
  proteinG: number | null;
  bodyWeightKg: number | null;
};

export type TrainingReadiness = "caution" | "normal" | "unknown";

export function assessTrainingReadiness(input: RecoveryInput): TrainingReadiness {
  const poorSleep =
    (input.sleepHours != null && input.sleepHours < 6.5) ||
    (input.sleepQuality != null && input.sleepQuality <= 2);
  const lowProtein =
    input.proteinG != null &&
    input.bodyWeightKg != null &&
    input.bodyWeightKg > 0 &&
    input.proteinG / input.bodyWeightKg < 1.2;

  if (poorSleep || lowProtein) return "caution";

  const hasSleep = input.sleepHours != null || input.sleepQuality != null;
  const hasNutrition = input.proteinG != null && input.bodyWeightKg != null;
  return hasSleep || hasNutrition ? "normal" : "unknown";
}
