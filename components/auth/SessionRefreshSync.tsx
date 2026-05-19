"use client";

import { useEffect } from "react";

import {
  readRefreshTokenSync,
  requestPersistentStorage,
  saveRefreshToken,
} from "./session-storage";

/** Монтируется во всех authed-страницах (/(app)/layout). При каждом
 *  заходе:
 *  - если в storage пусто — сразу запрашивает свежий refresh-токен;
 *  - если уже есть и moложе суток — пропускает;
 *  - если старше суток — обновляет (обновление дешёвое, токен заодно
 *    переписывается в localStorage и IndexedDB, что освежает их «возраст»
 *    в эвристиках iOS ITP).
 *
 *  Цель — гарантировать, что после первого же входа PWA получит
 *  локальную копию долгоживущего токена. Без неё SessionAutoRestore
 *  на /login не сможет вернуть пользователя в аккаунт. */
export function SessionRefreshSync() {
  useEffect(() => {
    requestPersistentStorage();

    const existing = readRefreshTokenSync();
    const ageMs = existing ? Date.now() - existing.savedAt : Infinity;
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (existing && ageMs < ONE_DAY) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/issue-refresh", {
          method: "GET",
          credentials: "same-origin",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { token?: unknown };
        if (typeof data.token === "string") {
          await saveRefreshToken(data.token);
        }
      } catch {
        // тихо: следующий рендер попробует снова
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
