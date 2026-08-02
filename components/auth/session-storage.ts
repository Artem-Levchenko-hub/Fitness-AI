/**
 * До v1.2.1 здесь хранился refresh bearer в localStorage и IndexedDB. Новый
 * refresh существует только в HttpOnly cookie: JS его не получает и не может
 * случайно раскрыть. Оставляем только безопасную миграционную чистку старых
 * копий у пользователей, которые обновляются с прошлой версии.
 */
export const SESSION_REFRESH_STORAGE_KEY = "fitness:refresh-token";
const IDB_NAME = "fitness-auth";

export async function clearLegacyRefreshStorage(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(SESSION_REFRESH_STORAGE_KEY);
  } catch {
    // Private mode / storage policy: cookie-based login continues to work.
  }

  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(IDB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}
