/** Самочувствие после сессии (паттерн pliability) — атлет одним тапом отмечает,
 *  как далась тренировка. Чистая доменная единица: канонический список тегов
 *  + их человекочитаемые подписи + строка-заметка для AI-контекста.
 *
 *  Тег ложится в workout_note («новый фактор жизни без нового канала»), который
 *  тренер читает целиком при разборе следующей сессии. */

export type FeelingTagKey = "easy" | "normal" | "hard";

export type FeelingTag = {
  key: FeelingTagKey;
  /** Подпись в UI и в тексте заметки. */
  label: string;
};

/** По возрастанию тяжести слева→направо: легко · норм · тяжело. */
export const FEELING_TAGS: readonly FeelingTag[] = [
  { key: "easy", label: "легко" },
  { key: "normal", label: "норм" },
  { key: "hard", label: "тяжело" },
] as const;

const LABEL_BY_KEY: Record<FeelingTagKey, string> = Object.fromEntries(
  FEELING_TAGS.map((t) => [t.key, t.label]),
) as Record<FeelingTagKey, string>;

function isFeelingTag(value: string): value is FeelingTagKey {
  return value === "easy" || value === "normal" || value === "hard";
}

/** Строит строку-заметку самочувствия для AI-контекста. Невалидный/пустой
 *  тег → null (fail-soft: заметка не пишется, R-37 без мусора). */
export function feelingNoteLine(tag: string): string | null {
  if (!isFeelingTag(tag)) return null;
  return `Самочувствие после сессии: ${LABEL_BY_KEY[tag]}`;
}
