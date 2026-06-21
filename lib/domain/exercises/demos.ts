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

/** Все пути demo-гифок в стабильном (по slug) порядке — для рандомного лоадера
 *  ожидания разбора. Стабильность нужна, чтобы выбор был воспроизводим при том
 *  же значении RNG (тест). */
export function allDemoGifs(): string[] {
  return Object.keys(EXERCISE_DEMOS)
    .sort()
    .map((slug) => EXERCISE_DEMOS[slug]!.gif);
}

/** Случайная demo-гифка. RNG инжектится (R-7: домен без Math.random/Date) —
 *  клиент передаёт Math.random. null — гифок нет (каталог пуст). */
export function pickRandomDemoGif(rand: () => number): string | null {
  const gifs = allDemoGifs();
  if (gifs.length === 0) return null;
  const i = Math.min(gifs.length - 1, Math.floor(rand() * gifs.length));
  return gifs[i] ?? null;
}
