/**
 * H15.3b — канонический ключ идемпотентности подхода (`clientSetId`).
 *
 * Каждая запись подхода (онлайн ИЛИ офлайн-реплей) несёт стабильный client-UUID
 * → `workout_sets.client_set_id` (partial-unique, H15.3a). Реплей того же ключа
 * — no-op (`onConflictDoNothing`). Этот модуль — ЧИСТЫЙ валидатор ключа из
 * FormData на стороне server-action: невалидный/отсутствующий ключ НЕ роняет
 * запись, а падает в NULL (legacy/онлайн-путь без идемпотентности, столп 4,
 * fail-soft R-10). Генерация ключа (crypto.randomUUID) живёт в клиентском
 * `lib/storage/outbox` (makeClientId) — здесь только разбор.
 */

/** Канонический UUID-формат (8-4-4-4-12 hex). Не привязан к версии — принимаем
 *  любой well-formed UUID (crypto.randomUUID даёт v4, но валидатор лоялен). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Разобрать `clientSetId` из FormData. Валидный UUID → нормализованная строка;
 * пусто / не строка / мусор → null (NULL-вставка, без идемпотентности).
 */
export function parseClientSetId(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return UUID_RE.test(trimmed) ? trimmed.toLowerCase() : null;
}
