export const SET_SCHEMES = ["straight", "myo_reps"] as const;
export type SetScheme = (typeof SET_SCHEMES)[number];

export const MYO_SET_ROLES = ["activation", "mini"] as const;
export type MyoSetRole = (typeof MYO_SET_ROLES)[number];

export const DEFAULT_MYO_MINI_SETS = 3;
export const DEFAULT_MYO_REPS_PERCENT = 30;
export const DEFAULT_MYO_REST_SECONDS = 20;
export const DEFAULT_MYO_FIRST_REST_SECONDS = 40;

export function myoTotalSets(miniSets: number): number {
  return 1 + Math.max(1, Math.round(miniSets));
}

export function myoMiniReps(
  activationReps: number,
  percent = DEFAULT_MYO_REPS_PERCENT,
): number {
  const safeReps = Math.max(1, activationReps);
  const safePercent = Math.min(50, Math.max(10, percent));
  return Math.max(1, Math.round((safeReps * safePercent) / 100));
}

export function myoRoleForSetIndex(setIndex: number): MyoSetRole {
  return setIndex === 0 ? "activation" : "mini";
}

export function elapsedRestSeconds(
  startedAt: Date | null,
  nowMs = Date.now(),
): number | null {
  if (!startedAt) return null;
  return Math.min(
    3600,
    Math.max(0, Math.round((nowMs - startedAt.getTime()) / 1000)),
  );
}
