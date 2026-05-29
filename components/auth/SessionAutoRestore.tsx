"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import {
  deleteRefreshToken,
  readRefreshToken,
  requestPersistentStorage,
} from "./session-storage";

type Status = "idle" | "checking" | "restoring";

/** Монтируется на /login. Если в localStorage/IDB есть refresh-токен
 *  (был успешный логин ранее) — обменивает его на свежий
 *  session-cookie через /api/auth/restore и редиректит на
 *  callbackUrl. Это и есть «нативное» поведение PWA на iOS:
 *  один раз вошёл, дальше открываешь — и сразу в дашборде. */
export function SessionAutoRestore() {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    requestPersistentStorage();

    let cancelled = false;

    (async () => {
      const stored = await readRefreshToken();
      if (cancelled || !stored) return;

      // Этот setState намеренно идёт после mount: токен может
      // лежать в IDB (асинхронно), и SSR-рендер обязан совпасть
      // с первым клиент-рендером (status="idle") до hydration.
       
      setStatus("checking");

      try {
        const res = await fetch("/api/auth/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: stored.token }),
          credentials: "same-origin",
        });
        if (cancelled) return;

        if (res.ok) {
          setStatus("restoring");
          const next = getCallbackUrl();
          window.location.replace(next);
          return;
        }

        if (res.status === 401) {
          // Токен протух — стираем чтобы не зацикливать.
          await deleteRefreshToken();
        }
        setStatus("idle");
      } catch {
        if (!cancelled) setStatus("idle");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "idle") return null;

  return (
    <div
      className="bg-background/85 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="bg-card border-border flex items-center gap-3 rounded-2xl border px-5 py-4 shadow-lg">
        <Loader2 className="text-primary size-5 animate-spin" />
        <span className="text-sm font-medium">
          {status === "checking"
            ? "Восстанавливаем сессию…"
            : "Открываем приложение…"}
        </span>
      </div>
    </div>
  );
}

function getCallbackUrl(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const cb = params.get("callbackUrl");
    if (cb && cb.startsWith("/") && !cb.startsWith("//")) return cb;
  } catch {
    // ignore
  }
  return "/dashboard";
}
