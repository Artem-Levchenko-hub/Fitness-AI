/**
 * H15.3a — клиентский outbox офлайн-мутаций тренировки (фундамент, без UI).
 *
 * Когда сети нет, мутация (запись подхода + завершение тренировки H15.3c; старт
 * офлайн — будущий под-слайс) кладётся сюда с стабильным client-generated ключом
 * и реплеится при реконнекте
 * (H15.4) ЧЕРЕЗ ТОТ ЖЕ server-action — не сырой Request (action-ID
 * build-специфичен). Идемпотентность держит ОДИН канонический ключ — `clientId`
 * (= `clientSetId` для recordSet): и здесь (dedupe/keyPath), и в БД
 * (workout_sets.client_set_id partial-unique + onConflictDoNothing). Двойной
 * дренаж не создаёт дубля.
 *
 * Пьюр-функции (makeClientId / serialize / parse / dedupeByClientId) — без
 * window/indexedDB, юнит-тестируемы в node. Адаптер (enqueue/listPending/
 * remove/clear) трогает IndexedDB и защищён от SSR/недоступности (fail-soft
 * R-10) — его проверяет рантайм (Playwright offline в H15.3b), не юнит.
 */

/** Виды мутаций в очереди. H15.3c добавил finishWorkout (старт офлайн —
 *  будущий под-слайс). */
export type OutboxMutationKind = "recordSet" | "finishWorkout";

export type OutboxMutation = {
  /** Стабильный client-UUID — канонический ключ идемпотентности (для recordSet
   *  совпадает с `clientSetId` строки workout_sets). */
  clientId: string;
  kind: OutboxMutationKind;
  /** Сериализуемая нагрузка для реплея через server-action. */
  payload: Record<string, unknown>;
  /** Момент постановки в очередь (epoch ms) — дренаж FIFO по возрастанию. */
  queuedAt: number;
};

const DB_NAME = "fit-outbox";
const DB_VERSION = 1;
const STORE = "mutations";

// ── Пьюр-логика (без window) ────────────────────────────────────────────────

/** Стабильный UUID мутации. Генерируется ОДИН раз в момент офлайн-записи и
 *  не меняется при реплее — иначе идемпотентность сломается. */
export function makeClientId(): string {
  return crypto.randomUUID();
}

function isValidMutation(value: unknown): value is OutboxMutation {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.clientId === "string" &&
    m.clientId.length > 0 &&
    (m.kind === "recordSet" || m.kind === "finishWorkout") &&
    typeof m.payload === "object" &&
    m.payload !== null &&
    typeof m.queuedAt === "number" &&
    Number.isFinite(m.queuedAt)
  );
}

export function serializeOutbox(mutations: OutboxMutation[]): string {
  return JSON.stringify(mutations);
}

/** Fail-soft парс: битый JSON → []; невалидные записи отброшены поодиночке
 *  (одна порча не теряет всю очередь). */
export function parseOutbox(raw: string | null): OutboxMutation[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isValidMutation);
  } catch {
    return [];
  }
}

/** Свёртка по clientId — последняя запись на ключ побеждает (правка
 *  оптимистичного подхода до синка); порядок первого появления сохранён. */
export function dedupeByClientId(mutations: OutboxMutation[]): OutboxMutation[] {
  const byId = new Map<string, OutboxMutation>();
  for (const m of mutations) byId.set(m.clientId, m);
  return [...byId.values()];
}

// ── IndexedDB-адаптер (window-guarded, fail-soft) ───────────────────────────

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        // keyPath=clientId → put одного clientId перезаписывает (дедуп на уровне
        // хранилища, зеркало dedupeByClientId).
        db.createObjectStore(STORE, { keyPath: "clientId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Поставить мутацию в очередь. Повторный put того же clientId перезаписывает
 *  (идемпотентно). Недоступный IndexedDB / приватный режим → fail-soft. */
export async function enqueue(mutation: OutboxMutation): Promise<void> {
  if (!hasIndexedDb()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(mutation);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* fail-soft — потеря буфера не должна ронять ввод подхода */
  }
}

/** Все незадренированные мутации, FIFO по queuedAt. */
export async function listPending(): Promise<OutboxMutation[]> {
  if (!hasIndexedDb()) return [];
  try {
    const db = await openDb();
    const all = await new Promise<OutboxMutation[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as OutboxMutation[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return dedupeByClientId(all.filter(isValidMutation)).sort(
      (a, b) => a.queuedAt - b.queuedAt,
    );
  } catch {
    return [];
  }
}

/** Убрать мутацию после успешного реплея. */
export async function remove(clientId: string): Promise<void> {
  if (!hasIndexedDb()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(clientId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* fail-soft */
  }
}

export async function clear(): Promise<void> {
  if (!hasIndexedDb()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* fail-soft */
  }
}
