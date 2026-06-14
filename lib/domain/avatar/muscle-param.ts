/** H17.0 — глубокий линк `/profile?muscle=<key>` открывает панель мышцы на
 *  маунте (петля «текст тренера → тело»: силуэт под разбором ведёт сюда).
 *  Валидирует сырой query-параметр против канонического словаря MUSCLE_KEYS —
 *  чужой/битый ключ → null (R-10/R-37: панель просто не открывается, не падает).
 *
 *  Чистый модуль (R-7): только домен мышц, без db/next/ui. */

import { MUSCLE_KEYS, type MuscleKey } from "./heat";

/**
 * Приводит значение searchParams `muscle` к валидной группе мышц или null.
 * searchParams отдаёт `string | string[] | undefined` (Next 16) — массив
 * (повтор ключа в URL) схлопываем к первому элементу. Неизвестный ключ → null.
 */
export function parseMuscleParam(
  raw: string | string[] | undefined,
): MuscleKey | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  return (MUSCLE_KEYS as readonly string[]).includes(value)
    ? (value as MuscleKey)
    : null;
}
