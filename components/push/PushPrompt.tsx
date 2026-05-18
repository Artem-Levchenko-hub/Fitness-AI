"use client";

import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { removeSubscription, saveSubscription } from "@/server/actions/push";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
  return buffer;
}

type State = "idle" | "loading" | "denied" | "unsupported" | "subscribed";

/** Запрашивает у браузера разрешение на нотификации, регистрирует подписку
 *  и сохраняет её на сервере. Если уже подписан — даёт кнопку «отключить».
 *  Безмолвно ничего не делаем — пользователь сам нажимает кнопку. */
export function PushPrompt({
  vapidPublicKey,
}: {
  vapidPublicKey: string | undefined;
}) {
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    // Эффект синхронизирует React state с runtime browser-feature detection
    // (доступен только после mount). Это легитимный setState в effect, а не
    // cascading re-render по prop'у.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    void navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      if (sub) setState("subscribed");
    });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  if (state === "unsupported") return null;
  if (!vapidPublicKey) {
    return (
      <p className="text-muted-foreground text-xs">
        Push-уведомления не настроены администратором.
      </p>
    );
  }

  const subscribe = async () => {
    setState("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const json = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Не удалось получить ключи подписки");
      }
      await saveSubscription({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        userAgent: navigator.userAgent,
      });
      setState("subscribed");
    } catch (e) {
      console.error(e);
      setState("idle");
    }
  };

  const unsubscribe = async () => {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await removeSubscription(sub.endpoint);
      }
      setState("idle");
    } catch (e) {
      console.error(e);
      setState("subscribed");
    }
  };

  if (state === "subscribed") {
    return (
      <div className="bg-card border-border flex items-center justify-between gap-3 rounded-xl border p-4">
        <div className="flex items-center gap-2">
          <Bell className="text-primary size-4" />
          <p className="text-sm font-medium">Уведомления включены</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={unsubscribe}
          disabled={state !== "subscribed"}
        >
          Отключить
        </Button>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="bg-warning/5 border-warning/30 flex items-center gap-2 rounded-xl border p-4">
        <BellOff className="text-warning size-4" />
        <p className="text-xs leading-relaxed">
          Браузер заблокировал уведомления. Откройте настройки сайта и
          разрешите вручную.
        </p>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={state === "loading"}
      onClick={subscribe}
    >
      <Bell className="size-4" />
      {state === "loading" ? "Подключаю…" : "Включить напоминания"}
    </Button>
  );
}
