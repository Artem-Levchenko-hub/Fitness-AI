/**
 * H13.1 — резолв ссылок «строка разбора → история упражнения».
 *
 * Разбор (TrainerResultCard.exerciseComparisons) хранит упражнение по ИМЕНИ
 * (LLM эмитит nameRu, см. exercise-comparison.ts). Чтобы строка стала ссылкой
 * на /exercises/[id], имя нужно резолвить в exerciseId — но ТОЛЬКО по
 * упражнениям РАЗБИРАЕМОЙ тренировки (имена уникальны в рамках сессии). Так
 * ссылка ведёт в данные владельца разбора, а не в чужую/случайную историю.
 *
 * Чистая (R-7): db/auth не импортит, принимает уже выбранные строки.
 */

export type ExerciseNameRow = {
  exerciseId: string;
  exerciseNameRu: string;
  exerciseNameEn: string;
};

/**
 * Карта «имя упражнения → exerciseId» из упражнений тренировки. Ключи — и
 * nameRu, и nameEn (LLM обычно эмитит nameRu, но en страхует мисматч локали).
 * Имя с пустыми краями нормализуется trim. Дубль имени в рамках тренировки —
 * last-wins (обе строки разбора уведут в один id, что безвредно).
 */
export function buildExerciseLinkMap(
  rows: ExerciseNameRow[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const r of rows) {
    const ru = r.exerciseNameRu?.trim();
    const en = r.exerciseNameEn?.trim();
    if (ru) map[ru] = r.exerciseId;
    if (en) map[en] = r.exerciseId;
  }
  return map;
}

/**
 * Путь к истории упражнения по имени из строки разбора. null → имя не из этой
 * тренировки (fail-soft R-37: строка остаётся статичной, без битой ссылки).
 */
export function resolveExerciseHref(
  name: string,
  links: Record<string, string> | undefined,
): string | null {
  if (!links) return null;
  const id = links[name?.trim()];
  return id ? `/exercises/${id}` : null;
}
