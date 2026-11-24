export const SET_EFFORTS = ["near_failure", "failure"] as const;
export type SetEffort = (typeof SET_EFFORTS)[number];

export function parseSetEffort(value: unknown): SetEffort | null {
  return value === "near_failure" || value === "failure" ? value : null;
}

export function setEffortLabel(effort: SetEffort): string {
  return effort === "near_failure" ? "Полуотказ" : "Отказ";
}
