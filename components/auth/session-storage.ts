/** Хранилище refresh-токена: localStorage + IndexedDB параллельно.
 *
 *  iOS Safari в standalone-режиме (PWA с домашнего экрана) применяет
 *  ITP к localStorage — данные могут стираться через 7 дней без
 *  активных взаимодействий. IndexedDB на iOS PWA более устойчив
 *  (особенно когда `navigator.storage.persist()` дала true). Пишем
 *  в оба, читаем по первому совпадению. */

export const SESSION_REFRESH_STORAGE_KEY = "fitness:refresh-token";
const IDB_NAME = "fitness-auth";
const IDB_STORE = "tokens";
const IDB_VERSION = 1;

export type StoredToken = {
  token: string;
  savedAt: number;
};

/** Безопасный JSON-парс stored-формата. Поддерживает legacy-строку. */
function parseStored(raw: string | null): StoredToken | null {
  if (!raw) return null;
  if (!raw.startsWith("{")) {
    return { token: raw, savedAt: Date.now() };
  }
  try {
    const obj = JSON.parse(raw) as Partial<StoredToken>;
    if (typeof obj.token === "string" && typeof obj.savedAt === "number") {
      return { token: obj.token, savedAt: obj.savedAt };
    }
  } catch {
    // ignore
  }
  return null;
}

function serialize(token: StoredToken): string {
  return JSON.stringify(token);
}

// ---- localStorage ---------------------------------------------------

function readLocal(): StoredToken | null {
  if (typeof window === "undefined") return null;
  try {
    return parseStored(window.localStorage.getItem(SESSION_REFRESH_STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeLocal(token: StoredToken): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_REFRESH_STORAGE_KEY, serialize(token));
  } catch {
    // ignore — приватный режим, переполнение и т.п.
  }
}

function deleteLocal(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_REFRESH_STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ---- IndexedDB ------------------------------------------------------

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(IDB_NAME, IDB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      try {
        if (!req.result.objectStoreNames.contains(IDB_STORE)) {
          req.result.createObjectStore(IDB_STORE);
        }
      } catch {
        // ignore
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

async function readIdb(): Promise<StoredToken | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(SESSION_REFRESH_STORAGE_KEY);
      req.onsuccess = () => {
        const value = req.result;
        if (!value) return resolve(null);
        if (typeof value === "string") return resolve(parseStored(value));
        if (
          typeof value === "object" &&
          typeof value.token === "string" &&
          typeof value.savedAt === "number"
        ) {
          resolve({ token: value.token, savedAt: value.savedAt });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeIdb(token: StoredToken): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(token, SESSION_REFRESH_STORAGE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function deleteIdb(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(SESSION_REFRESH_STORAGE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

// ---- Public API -----------------------------------------------------

export async function readRefreshToken(): Promise<StoredToken | null> {
  const local = readLocal();
  if (local) return local;
  const idb = await readIdb();
  if (idb) {
    // самосинхронизация: ITP вычистил localStorage, но IDB живёт.
    writeLocal(idb);
    return idb;
  }
  return null;
}

export async function saveRefreshToken(token: string): Promise<void> {
  const stored: StoredToken = { token, savedAt: Date.now() };
  writeLocal(stored);
  await writeIdb(stored);
}

export async function deleteRefreshToken(): Promise<void> {
  deleteLocal();
  await deleteIdb();
}

export function readRefreshTokenSync(): StoredToken | null {
  return readLocal();
}

/** Проактивно просим браузер не вычищать наш storage. На iOS PWA
 *  Apple обычно отказывает (false), но запрос всё равно повышает
 *  приоритет домена в их эвристике. */
export function requestPersistentStorage(): void {
  if (typeof navigator === "undefined") return;
  const storage = navigator.storage;
  if (!storage || typeof storage.persist !== "function") return;
  storage.persist().catch(() => {
    // best effort
  });
}
