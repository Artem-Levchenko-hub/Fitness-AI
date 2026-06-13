/** H16.4 — «мышцы сегодняшней сессии» для мини-силуэта в карточке ожидания
 *  разбора (столп 2: пока тренер думает, атлет видит свои нагруженные группы +
 *  книжный факт про них). Берёт сырые ключи групп из упражнений тренировки
 *  (/api/ai/trainer/insights отдаёт их детерминированно из БД) и приводит к
 *  каноническому набору: только известные группы, без дублей, в порядке
 *  MUSCLE_KEYS (тот же, что красит 3D-аватар) + готовая RU-подпись.
 *
 *  Чистый модуль (R-7): нет импортов db/three/ui. */

import { MUSCLE_KEYS, muscleLabelRu, type MuscleKey } from "./heat";

export type SessionMuscleSummary = {
  /** Группы сессии в каноническом порядке MUSCLE_KEYS, только известные, без дублей. */
  keys: MuscleKey[];
  /** RU-перечисление для подписи/aria: «Грудь, Трицепс». Пусто → "". */
  label: string;
};

/**
 * Схлопывает сырые ключи групп (из join'а упражнение↔группа-мышц) в упорядоченный
 * уникальный набор для подсветки силуэта. Неизвестные ключи (нет в MUSCLE_KEYS)
 * отбрасываются — силуэт рисует только канонические 14 групп. Порядок —
 * канонический MUSCLE_KEYS, не порядок входа (стабильная подпись).
 */
export function summarizeSessionMuscles(
  rawKeys: readonly string[],
): SessionMuscleSummary {
  const present = new Set(rawKeys);
  const keys = MUSCLE_KEYS.filter((k) => present.has(k));
  return { keys, label: keys.map(muscleLabelRu).join(", ") };
}
