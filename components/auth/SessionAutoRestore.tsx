"use client";

import { useEffect } from "react";

import { clearLegacyRefreshStorage } from "./session-storage";

/** Удаляет legacy JS bearer на login. Автовосстановление теперь делает только
 * proxy через HttpOnly cookie; UI не получает и не пересылает refresh token. */
export function SessionAutoRestore() {
  useEffect(() => {
    void clearLegacyRefreshStorage();
  }, []);
  return null;
}
