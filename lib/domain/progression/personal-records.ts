import { estimatedOneRepMax } from "./one-rep-max";

export type PRSet = {
  exerciseId: string;
  weightKg: number;
  reps: number;
  completedAt: Date;
};

export type PRCheckResult = {
  isNewPR: boolean;
  /** Δ оценочного 1RM против предыдущего лучшего (>0 если new PR). */
  improvementKg: number;
  previousBestOneRepMaxKg: number;
  candidateOneRepMaxKg: number;
};

/** Проверка нового PR по оценочному 1RM против истории.
 *  history может включать кандидата — он отфильтровывается по completedAt. */
export function checkPersonalRecord(
  candidate: PRSet,
  history: ReadonlyArray<PRSet>,
): PRCheckResult {
  const candidateOneRepMaxKg = estimatedOneRepMax(
    candidate.weightKg,
    candidate.reps,
  );

  let previousBestOneRepMaxKg = 0;
  for (const h of history) {
    if (h.exerciseId !== candidate.exerciseId) continue;
    if (h.completedAt >= candidate.completedAt) continue;
    const e = estimatedOneRepMax(h.weightKg, h.reps);
    if (e > previousBestOneRepMaxKg) previousBestOneRepMaxKg = e;
  }

  return {
    isNewPR: candidateOneRepMaxKg > previousBestOneRepMaxKg,
    improvementKg: candidateOneRepMaxKg - previousBestOneRepMaxKg,
    previousBestOneRepMaxKg,
    candidateOneRepMaxKg,
  };
}
