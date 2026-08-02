"use client";

import { useEffect } from "react";

import { clearLegacyRefreshStorage } from "./session-storage";

/** Монтируется в authed shell. Удаляет legacy bearer из Web Storage и
 * сообщает service worker удалить остатки runtime cache от прежней сессии. */
export function SessionRefreshSync() {
  useEffect(() => {
    void clearLegacyRefreshStorage();
    void purgePrivateRuntimeCache();
  }, []);

  return null;
}

export async function purgePrivateRuntimeCache(): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const registration of registrations) {
    registration.active?.postMessage({ type: "FITNESS_PURGE_RUNTIME_CACHE" });
  }
}
