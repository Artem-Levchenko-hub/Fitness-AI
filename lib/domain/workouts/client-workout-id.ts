/**
 * H15.3c-2 — канонический ключ идемпотентности офлайн-СТАРТА тренировки
 * (`clientWorkoutId`).
 *
 * Когда тренировку начали без сети, у неё нет серверного id. Клиент генерирует
 * стабильный UUID, под которым старт кладётся в outbox; при реконнекте дренаж
 * (будущий под-слайс) создаёт реальную тренировку, помечая её этим ключом →
 * `workouts.client_workout_id` (partial-unique). Повторный дренаж того же ключа
 * находит уже созданную тренировку (existing-check в repo) и не плодит дубль.
 *
 * Этот модуль — ЧИСТЫЙ валидатор ключа из FormData на стороне server-action,
 * зеркало `parseClientSetId` для подходов: невалидный/отсутствующий ключ НЕ
 * роняет старт, а падает в NULL (онлайн-путь без клиентского ключа, столп 4,
 * fail-soft R-10). Генерация ключа (crypto.randomUUID) живёт в клиентском
 * `lib/storage/outbox` (makeClientId) — здесь только разбор.
 */

/** Канонический UUID-формат (8-4-4-4-12 hex). Лоялен к версии (crypto.randomUUID
 *  даёт v4). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Разобрать `clientWorkoutId` из FormData. Валидный UUID → нормализованная
 * строка; пусто / не строка / мусор → null (онлайн-старт без идемпотентного
 * ключа).
 */
export function parseClientWorkoutId(
  raw: FormDataEntryValue | null,
): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return UUID_RE.test(trimmed) ? trimmed.toLowerCase() : null;
}
