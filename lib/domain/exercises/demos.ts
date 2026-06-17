/** Demo GIFs for system exercises. Pure domain (R-7): no db/auth/UI imports.
 *  The slug→asset table is auto-generated (demos.generated.ts) by
 *  scripts/fetch-exercise-demos.ts; this module adds the lookup helpers. */

import { EXERCISE_DEMOS, type ExerciseDemoAsset } from "./demos.generated";

export { EXERCISE_DEMOS };
export type { ExerciseDemoAsset };

/** Self-hosted demo GIF for a system exercise, or null when none exists
 *  (custom exercises, or system exercises without a matched demo). Keyed by
 *  the stable `slug` — never the per-seed exercise UUID. */
export function getExerciseDemo(
  slug: string | null | undefined,
): ExerciseDemoAsset | null {
  if (!slug) return null;
  return EXERCISE_DEMOS[slug] ?? null;
}

export function hasExerciseDemo(slug: string | null | undefined): boolean {
  return getExerciseDemo(slug) !== null;
}
